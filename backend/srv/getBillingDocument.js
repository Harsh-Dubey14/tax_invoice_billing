const cds = require("@sap/cds");
const axios = require("axios");
require("dotenv").config();
const formatSAPDate = require("./utils/formatDate");

module.exports = async function () {
  const { billingDocument } = this.entities;
  const { ABAP_API_URL, ABAP_USER, ABAP_PASS } = process.env;
  const axiosConfig = { auth: { username: ABAP_USER, password: ABAP_PASS } };

  // --- Fetch Billing Items ---
  const fetchBillingItems = async (billingDocumentId) => {
    const url = `${process.env.ABAP_ITEM_API_URL}?$filter=BillingDocument eq '${billingDocumentId}'&$format=json`;
    const res = await axios.get(url, axiosConfig);
    return res.data.d?.results || res.data.value || [];
  };

  // --- Map Billing Data ---
  const mapBillingData = async (header, itemsRaw, req) => {
    // You can reuse the same mapBillingData from service.js or move it to a shared util
  };
  

  // --- READ handler ---
  this.on("READ", billingDocument, async (req) => {
    try {
      const billingDocumentId =
        req.params?.[0] || req.query?.SELECT?.from?.ref?.[0]?.where?.[2]?.val;
            console.log("Request params:", req.params);
    console.log("Request query:", req.query);
    console.log("BillingDocumentId:", billingDocumentId);

      if (!billingDocumentId) {
        const url = `${ABAP_API_URL}?$top=50000&$format=json`;
        const response = await axios.get(url, axiosConfig);
        const results = response.data.value || (response.data.d && response.data.d.results) || [];
        return results.map((doc) => ({
          BillingDocument: doc.BillingDocument,
          billingDocumentID: doc.BillingDocument,
          BillingDocumentDate: formatSAPDate(doc.BillingDocumentDate),
          BillingDocumentType: doc.BillingDocumentType,
          CompanyCode: doc.CompanyCode,
          DocumentCategory: doc.SDDocumentCategory,
          Division: doc.Division,
          FiscalYear: doc.FiscalYear,
          salesOrganization: doc.SalesOrganization,
          DistributionChannel: doc.DistributionChannel,
        }));
      }

      const header = await axios.get(`${ABAP_API_URL}('${billingDocumentId}')?$format=json`, axiosConfig);
      const itemsRaw = await fetchBillingItems(billingDocumentId);

      return await mapBillingData(header.data.d || header.data, itemsRaw, req);
    } catch (err) {
      console.error("Error fetching billing document:", err.message);
      req.reject(err.response?.status || 502, `Error fetching data from remote system: ${err.message}`);
    }
  });
};
