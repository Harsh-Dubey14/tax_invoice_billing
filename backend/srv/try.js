const cds = require("@sap/cds");
const axios = require("axios");
require("dotenv").config();
const formatSAPDate = require("./utils/formatDate");
const stateCodeMap = require("./utils/stateCodeMap");

module.exports = async function () {
  const { billingDocument } = this.entities;

  const {
    ABAP_API_URL,
    ABAP_ITEM_API_URL,
    ABAP_USER,
    ABAP_PASS,
    SO_API_URL,
    INCOTERM_API_URL,
    DELIVERY_ITEM_API_URL,
    DELIVERY_HEADER_API_URL,
    ZI_PLANT1_API_URL,
    ZCE_TAX_DETAILS_API_URL,
    BUSINESS_PARTNER_API_URL,
    PRODUCT_PLANT_API_URL,
  } = process.env;

  const axiosConfig = { auth: { username: ABAP_USER, password: ABAP_PASS } };

  const safeGet = (promise) =>
    promise
      .then(
        (res) =>
          res.data.value ||
          (res.data.d && res.data.d.results) ||
          res.data.d ||
          res.data
      )
      .catch(() => null);

  // --- Fetch Billing Header ---
  const fetchBillingHeader = async (billingDocumentId) => {
    const url = `${ABAP_API_URL}('${encodeURIComponent(
      billingDocumentId
    )}')?$format=json`;
    const res = await axios.get(url, axiosConfig);
    return res.data.d || res.data;
  };

  // --- Fetch Billing Items from item API ---
  const fetchBillingItems = async (billingDocumentId) => {
    const url = `${ABAP_ITEM_API_URL}?$filter=BillingDocument eq '${billingDocumentId}'&$format=json`;
    const res = await axios.get(url, axiosConfig);
    return res.data.d?.results || res.data.value || [];
  };

  // --- Fetch Pricing Elements (Only for Subtotal) ---
  const fetchPricingElements = async (item) => {
    try {
      const itemNumber = item.BillingDocumentItem.toString().padStart(6, "0");
      const url = `${ABAP_ITEM_API_URL}(BillingDocument='${item.BillingDocument}',BillingDocumentItem='${itemNumber}')/to_PricingElement?$format=json`;
      const res = await axios.get(url, axiosConfig);
      const results = res.data?.d?.results || [];

      // Only relevant condition types for subtotal
      let packing = 0,
        freight = 0,
        insurance = 0,
        discount = 0;

      results.forEach((pe) => {
        const value = Number(pe.ConditionAmount || pe.ConditionRateValue || 0);
        switch (pe.ConditionType) {
          case "ZPAC": // Packing
            packing += value;
            break;
          case "ZFRE": // Freight
            freight += value;
            break;
          case "ZINS": // Insurance
            insurance += value;
            break;
          case "ZDIS": // Discount
            discount += value;
            break;
        }
      });

      const itemAmount = Number(item.NetAmount) || 0;
      const subtotal = itemAmount + freight + packing + insurance + discount;
      console.log(`s:${subtotal},ia${itemAmount},f:${freight },d:${discount}`);

      return {
        BillingDocumentItem: item.BillingDocumentItem,
        itemAmount,
        packing,
        freight,
        insurance,
        discount,
        subtotal,
      };
    } catch (err) {
      console.error(
        `Error fetching pricing elements for item ${item.BillingDocumentItem}:`,
        err.message
      );
      const itemAmount = Number(item.NetAmount) || 0;
      return {
        BillingDocumentItem: item.BillingDocumentItem,
        itemAmount,
        packing: 0,
        freight: 0,
        insurance: 0,
        discount: 0,
        subtotal: itemAmount,
      };
    }
  };

  // --- Map Items and Subtotals ---
  const mapItemsAndPricing = async (itemsRaw) => {
    // map base item info
    const Items = itemsRaw.map((item) => ({
      BillingDocumentItem: item.BillingDocumentItem,
      Description: item.BillingDocumentItemText,
      quantity: item.BillingQuantity,
      unit: item.BillingQuantityUnit,
      amount: Number(item.NetAmount) || 0,
    }));

    // fetch pricing per item
    const pricingPromises = itemsRaw.map((item) => fetchPricingElements(item));
    const pricingResults = await Promise.all(pricingPromises);

    // combine both
    const PricingElements = Items.map((it) => {
      const pe = pricingResults.find(
        (r) => r.BillingDocumentItem === it.BillingDocumentItem
      );
      return { ...it, ...pe };
    });

    // totals
    const TotalAmount = PricingElements.reduce(
      (sum, p) => sum + (p.itemAmount || 0),
      0
    );
    const TotalFreight = PricingElements.reduce(
      (sum, p) => sum + (p.freight || 0),
      0
    );
    const TotalPacking = PricingElements.reduce(
      (sum, p) => sum + (p.packing || 0),
      0
    );
    const TotalInsurance = PricingElements.reduce(
      (sum, p) => sum + (p.insurance || 0),
      0
    );
    const TotalDiscount = PricingElements.reduce(
      (sum, p) => sum + (p.discount || 0),
      0
    );
    const TotalSubtotal = PricingElements.reduce(
      (sum, p) => sum + (p.subtotal || 0),
      0
    );

    console.log("Totals ->");
    console.log({
      TotalAmount,
      TotalFreight,
      TotalPacking,
      TotalInsurance,
      TotalDiscount,
      TotalSubtotal,
    });

    return {
      Items,
      PricingElements,
      totalSummary: {
        TotalAmount,
        TotalFreight,
        TotalPacking,
        TotalInsurance,
        TotalDiscount,
        TotalSubtotal,
      },
    };
  };

  // --- Map Full Billing Document ---
  const mapBillingData = async (header, itemsRaw, req) => {
    const BillingDocument = {
      billingDocumentID: header.BillingDocument,
      DocumentCategory: header.SDDocumentCategory,
      Division: header.Division,
      BillingDocument: header.BillingDocument,
      BillingDocumentDate: formatSAPDate(header.BillingDocumentDate),
      BillingDocumentType: header.BillingDocumentType,
      CompanyCode: header.CompanyCode,
      FiscalYear: header.FiscalYear,
      salesOrganization: header.SalesOrganization,
      DistributionChannel: header.DistributionChannel,
      invoiceNo: header.BillingDocument,
      invoiceDate: formatSAPDate(header.CreationDate),
      destinationCountry: header.Country,
      SoldToParty: header.SoldToParty,
      termsOfPayment: header.CustomerPaymentTerms || null,
      PaymentTermsName: null,
      motorVehicleNo: header.YY1_VehicleNo2_BDH,
    };

    const { Items, PricingElements, totalSummary } =
      await mapItemsAndPricing(itemsRaw);

    BillingDocument.TotalAmount = totalSummary.TotalAmount;
    BillingDocument.TotalDiscount = totalSummary.TotalDiscount;
    BillingDocument.TotalSubtotal = totalSummary.TotalSubtotal;
    

    return { BillingDocument, Items, PricingElements };
  };

  // --- CREATE handler ---
  this.on("CREATE", billingDocument, async (req) => {
    const { BillingDocument: billingDocumentId } = req.data;
    if (!billingDocumentId)
      return req.reject(400, 'A "BillingDocument" ID must be provided.');

    try {
      const header = await fetchBillingHeader(billingDocumentId);
      if (!header)
        return req.reject(
          404,
          `Billing Document '${billingDocumentId}' not found.`
        );
      const itemsRaw = await fetchBillingItems(billingDocumentId);

      return await mapBillingData(header, itemsRaw, req);
    } catch (err) {
      req.reject(
        err.response?.status || 502,
        `Error fetching data from remote system: ${err.message}`
      );
    }
  });
};
