const cds = require('@sap/cds');
const axios = require('axios');
require('dotenv').config();
const formatSAPDate = require('./utils/formatDate');
const stateCodeMap = require('./utils/stateCodeMap');
const { mapBillingData, safeGet } = require('./mapBillingData'); // we will move mapBillingData to a separate file

module.exports = async function () {
  const { billingDocument } = this.entities;
  const {
    ABAP_API_URL,
    ABAP_USER,
    ABAP_PASS,
  } = process.env;

  const axiosConfig = { auth: { username: ABAP_USER, password: ABAP_PASS } };

  this.on('READ', billingDocument, async (req) => {
    try {
      const billingDocumentId = req.params[0] || req.query.SELECT?.from?.ref?.[0]?.where?.[2]?.val;
      const url = billingDocumentId
        ? `${ABAP_API_URL}('${encodeURIComponent(billingDocumentId)}')?$expand=_Item,_Text&$format=json`
        : `${ABAP_API_URL}?$top=50000&$select=BillingDocument,BillingDocumentDate,SDDocumentCategory,Division,BillingDocumentType,CompanyCode,FiscalYear,SalesOrganization,DistributionChannel&$format=json`;

      const response = await axios.get(url, axiosConfig);

      if (billingDocumentId) {
        if (!response.data) return req.reject(404, `Billing Document '${billingDocumentId}' not found.`);
        return await mapBillingData(response.data.d || response.data, req);
      } else {
        const results = response.data.value || (response.data.d && response.data.d.results);
        if (!Array.isArray(results)) throw new Error('Expected an array of billing documents.');
        return results.map((data) => ({
          billingDocumentID: data.BillingDocument,
          DocumentCategory: data.SDDocumentCategory,
          Division: data.Division,
          BillingDocument: data.BillingDocument,
          BillingDocumentDate: data.BillingDocumentDate,
          BillingDocumentType: data.BillingDocumentType,
          CompanyCode: data.CompanyCode,
          FiscalYear: data.FiscalYear,
          salesOrganization: data.SalesOrganization,
          DistributionChannel: data.DistributionChannel,
        }));
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      req.reject(err.response?.status || 502, `Error fetching data from remote system: ${errorMsg}`);
    }
  });
};
