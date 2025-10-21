const cds = require("@sap/cds");
const axios = require("axios");
require("dotenv").config();
const formatSAPDate = require("./utils/formatDate"); // ✅ Missing import
const { mapBillingData, safeGet } = require("./mapBillingData");

module.exports = async function () {
  const { billingDocument } = this.entities;
  const { ABAP_API_URL, ABAP_ITEM_API_URL, ABAP_USER, ABAP_PASS } = process.env;

  const axiosConfig = { auth: { username: ABAP_USER, password: ABAP_PASS } };

  // --- Helper: Fetch Billing Header ---
  const fetchBillingHeader = async (billingDocumentId) => {
    const url = `${ABAP_API_URL}('${encodeURIComponent(
      billingDocumentId
    )}')?$format=json`;
    const res = await axios.get(url, axiosConfig);
    return res.data.d || res.data;
  };

  // --- Helper: Fetch Billing Items ---
  const fetchBillingItems = async (billingDocumentId) => {
    const url = `${ABAP_ITEM_API_URL}?$filter=BillingDocument eq '${billingDocumentId}'&$format=json`;
    const res = await axios.get(url, axiosConfig);
    return res.data.d?.results || res.data.value || [];
  };

  // --- READ ---
  this.on("READ", billingDocument, async (req) => {
    try {
      const billingDocumentId =
        req.params?.[0] ||
        req.query?.SELECT?.from?.ref?.[0]?.where?.[2]?.val;

      // ✅ If no specific BillingDocument ID provided, fetch all
      if (!billingDocumentId) {
        const url = `${ABAP_API_URL}?$top=50000&$format=json`;
        const response = await axios.get(url, axiosConfig);
        const results =
          response.data.value ||
          (response.data.d && response.data.d.results) ||
          [];

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

      const itemsRaw = await fetchBillingItems(billingDocumentId);
      return await mapBillingData(header, itemsRaw, req);
    } catch (err) {
      console.error("Error fetching billing document:", err.message);
      req.reject(
        err.response?.status || 502,
        `Error fetching data from remote system: ${err.message}`
      );
    }
  });
};
