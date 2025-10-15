
const cds = require('@sap/cds');
const axios = require('axios');
require('dotenv').config();
const formatSAPDate = require('./utils/formatDate');
const stateCodeMap = require('./utils/stateCodeMap');

module.exports = async function () {
  const { billingDocument } = this.entities;
  const {
    ABAP_API_URL,
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

  const mapBillingData = async (data, req) => {
    // --- Billing Document mapping ---
    const BillingDocument = {
      billingDocumentID: data.BillingDocument,
      DocumentCategory: data.SDDocumentCategory,
      Division: data.Division,
      BillingDocument: data.BillingDocument,
      BillingDocumentDate: formatSAPDate(data.BillingDocumentDate),
      BillingDocumentType: data.BillingDocumentType,
      CompanyCode: data.CompanyCode,
      FiscalYear: data.FiscalYear,
      salesOrganization: data.SalesOrganization,
      DistributionChannel: data.DistributionChannel,
      invoiceNo: data.BillingDocument,
      invoiceDate: formatSAPDate(data.CreationDate),
      destinationCountry: data.Country,
      SoldToParty: data.SoldToParty,
      termsOfPayment: data.CustomerPaymentTerms || null,
      PaymentTermsName: null,
      motorVehicleNo: data.YY1_VehicleNo2_BDH,
    };

    // --- Items ---
    const itemsRaw = (data._Item && data._Item.results) || data._Item || [];
    const Items = Array.isArray(itemsRaw)
      ? itemsRaw.map((item) => ({
          BillingDocumentItem: item.BillingDocumentItem,
          ItemCategory: item.SalesDocumentItemCategory,
          SalesDocumentItemType: item.SalesDocumentItemType,
          SalesDocument: item.SalesDocument,
          ReferenceSDDocument: item.ReferenceSDDocument,
          Description: item.BillingDocumentItemText,
          Batch: item.Batch,
          quantity: item.BillingQuantity,
          unit: item.BillingQuantityUnitSAPCode,
          amount: item.NetAmount,
          rate: Number(item.BillingQuantity)
            ? Number(item.NetAmount) / Number(item.BillingQuantity)
            : 0,
        }))
      : [];

    const salesDocIds = [
      ...new Set(Items.map((i) => i.SalesDocument).filter(Boolean)),
    ];
    const paymentTermsCode = data.CustomerPaymentTerms;

    // --- Fetch Sales Orders & Payment Terms ---
    let salesOrdersData = [];
    try {
      const promises = [];

      if (salesDocIds.length) {
        const filterQuery = salesDocIds
          .map((id) => `SalesOrder eq '${id}'`)
          .join(' or ');
        const url = `${SO_API_URL}?$filter=${filterQuery}&$select=SalesOrder,PurchaseOrderByCustomer,CustomerPurchaseOrderDate&$format=json`;
        promises.push(axios.get(url, axiosConfig).catch(() => null));
      } else promises.push(Promise.resolve(null));

      if (paymentTermsCode) {
        const url = `${INCOTERM_API_URL}(PaymentTerms='${paymentTermsCode}',Language='EN')?$select=PaymentTerms,PaymentTermsName&$format=json`;
        promises.push(axios.get(url, axiosConfig).catch(() => null));
      } else promises.push(Promise.resolve(null));

      const [soResponse, incotermResponse] = await Promise.all(promises);
      if (soResponse)
        salesOrdersData =
          soResponse.data.value ||
          (soResponse.data.d && soResponse.data.d.results) ||
          [];
      if (incotermResponse && incotermResponse.data) {
        const d = incotermResponse.data.d || incotermResponse.data;
        BillingDocument.PaymentTermsName = d.PaymentTermsName || null;
      }
    } catch (err) {
      return req.reject(500, `An unexpected error occurred: ${err.message}`);
    }

    // --- Fetch Delivery Items ---
    let allDeliveryItems = [];
    if (salesDocIds.length) {
      try {
        const deliveryFilter = salesDocIds
          .map((id) => `ReferenceSDDocument eq '${id}'`)
          .join(' or ');
        const deliveryItemsUrl = `${DELIVERY_ITEM_API_URL}?$filter=${deliveryFilter}&$select=DeliveryDocument,DeliveryDocumentItem,ReferenceSDDocument,ReferenceSDDocumentItem,Plant,Material&$format=json`;
        const deliveryItemsResponse = await axios.get(
          deliveryItemsUrl,
          axiosConfig
        );
        allDeliveryItems =
          deliveryItemsResponse.data.value ||
          (deliveryItemsResponse.data.d &&
            deliveryItemsResponse.data.d.results) ||
          [];
      } catch (err) {
        return req.reject(
          502,
          `Failed to fetch Delivery Items. Reason: ${err.message}`
        );
      }
    }

    const plantIds = new Set(),
      deliveryDocIds = new Set(),
      productPlantPairs = new Map();
    const DeliveryItems = allDeliveryItems.map((item) => {
      if (item.Plant) plantIds.add(item.Plant);
      if (item.DeliveryDocument) deliveryDocIds.add(item.DeliveryDocument);
      if (item.Material && item.Plant)
        productPlantPairs.set(`${item.Material}|${item.Plant}`, {
          productId: item.Material,
          plantId: item.Plant,
        });
      return {
        DeliveryDocument: item.DeliveryDocument,
        Material: item.Material,
        Plant: item.Plant,
        ReferenceSDDocument: item.ReferenceSDDocument,
        ReferenceSDDocumentItem: item.ReferenceSDDocumentItem,
      };
    });

    // --- Fetch Plant Details ---
    const plantPromises = [...plantIds].map((id) =>
      safeGet(
        axios.get(
          `${ZI_PLANT1_API_URL}?$filter=Plant eq '${id}'&$select=PlantName,Plant,StreetName,HouseNumber,CityName,PostalCode,Region,Country,BusinessPlace&$format=json`,
          axiosConfig
        )
      )
    );

    // --- Fetch Delivery Headers ---
    const headerPromises = [...deliveryDocIds].map((id) =>
      safeGet(
        axios.get(
          `${DELIVERY_HEADER_API_URL}?$filter=DeliveryDocument eq '${id}'&$select=DeliveryDocument,ShipToParty,SoldToParty&$format=json`,
          axiosConfig
        )
      )
    );

    // --- Fetch HSN ---
    const hsnPromises = [...productPlantPairs.values()].map(
      ({ productId, plantId }) =>
        safeGet(
          axios.get(
            `${PRODUCT_PLANT_API_URL}(Product='${productId}',Plant='${plantId}')?$select=Product,Plant,ConsumptionTaxCtrlCode&$format=json`,
            axiosConfig
          )
        )
    );

    const [plantResults, rawHeaderResults, hsnResults] = await Promise.all([
      Promise.all(plantPromises),
      Promise.all(headerPromises),
      Promise.all(hsnPromises),
    ]);

    const Plants = plantResults.flat().filter(Boolean);
    const HSN = hsnResults
      .filter(Boolean)
      .map((h) => ({ Product: h.Product, Plant: h.Plant, HSN: h.ConsumptionTaxCtrlCode || null }));

    const DeliveryHeaders = rawHeaderResults
      .flat()
      .filter(Boolean)
      .map((dh) => ({
        DeliveryDocument: dh.DeliveryDocument,
        ShipToParty: dh.ShipToParty,
        SoldToParty: dh.SoldToParty,
      }));

    // --- Fetch GST for Plant ---
    const businessPlaces = Plants.map((p) => p.BusinessPlace).filter(Boolean);
    const taxPromises = [...new Set(businessPlaces)].map((bp) =>
      safeGet(
        axios.get(
          `${ZCE_TAX_DETAILS_API_URL}?$filter=BusinessPlace eq '${bp}'&$select=BusinessPlace,IN_GSTIdentificationNumber&$format=json`,
          axiosConfig
        )
      )
    );
    const Tax = (await Promise.all(taxPromises))
      .flat()
      .filter(Boolean)
      .map((t) => ({ BusinessPlace: t.BusinessPlace, GST: t.IN_GSTIdentificationNumber }));

    // --- Fetch Business Partner Details (Buyer/Consignee) ---
    const allPartnerIds = new Set();
    DeliveryHeaders.forEach((dh) => {
      if (dh.SoldToParty) allPartnerIds.add(dh.SoldToParty);
      if (dh.ShipToParty) allPartnerIds.add(dh.ShipToParty);
    });

    const bpSelectFields =
      'BusinessPartner,FullName,HouseNumber,StreetName,StreetPrefixName,AdditionalStreetPrefixName,CityName,CompanyPostalCode,Country';
    const bpPromises = [...allPartnerIds].map((id) =>
      safeGet(
        axios.get(
          `${BUSINESS_PARTNER_API_URL}('${encodeURIComponent(id)}')/to_BusinessPartnerAddress?$select=${bpSelectFields}&$format=json`,
          axiosConfig
        )
      )
    );
    const rawPartnerData = (await Promise.all(bpPromises)).flat().filter(Boolean);
    const bpMap = new Map(rawPartnerData.map((p) => [
      p.BusinessPartner,
      {
        BusinessPartner: p.BusinessPartner,
        FullName: p.FullName,
        HouseNumber: p.HouseNumber,
        StreetName: p.StreetName,
        StreetPrefixName: p.StreetPrefixName,
        AdditionalStreetPrefixName: p.AdditionalStreetPrefixName,
        CityName: p.CityName,
        CompanyPostalCode: p.CompanyPostalCode,
        Country: p.Country,
      }
    ]));

    // --- Fetch GST for Buyer & Consignee ---
    const gstPromises = [...allPartnerIds].map(async (bpId) => {
      try {
        const res = await axios.get(
          `${BUSINESS_PARTNER_API_URL}('${encodeURIComponent(bpId)}')/to_BusinessPartnerTax?$format=json`,
          axiosConfig
        );
        const taxes = res.data?.d?.results || res.data?.results || [];
        const gstEntry = taxes.find((t) => t.BPTaxType === 'IN3');
        return { BusinessPartner: bpId, GSTIN: gstEntry?.BPTaxNumber || null };
      } catch {
        return { BusinessPartner: bpId, GSTIN: null };
      }
    });

    const gstData = await Promise.all(gstPromises);
    const gstMap = new Map(gstData.map((g) => [g.BusinessPartner, g.GSTIN]));

    const Buyer = [...new Set(DeliveryHeaders.map(h => h.SoldToParty).filter(Boolean))]
      .map(id => {
        const data = bpMap.get(id);
        if (data) data.GSTIN = gstMap.get(id) || null;
        return data;
      }).filter(Boolean);

    const Consignee = [...new Set(DeliveryHeaders.map(h => h.ShipToParty).filter(Boolean))]
      .map(id => {
        const data = bpMap.get(id);
        if (data) data.GSTIN = gstMap.get(id) || null;
        return data;
      }).filter(Boolean);

    // --- Sales Orders mapping ---
    const SalesOrders = salesOrdersData.map((so) => ({
      SalesOrder: so.SalesOrder,
      PurchaseOrderByCustomer: so.PurchaseOrderByCustomer,
      CustomerPurchaseOrderDate: formatSAPDate(so.CustomerPurchaseOrderDate),
    }));


      return {
      BillingDocument,
      Items,
      SalesOrders,
      DeliveryItems,
      Plants,
      DeliveryHeaders,
      Buyer,
      Consignee,
      HSN,
      Tax,
    };
  };
      // include other mapped arrays like SalesOrders, DeliveryItems, Plants, DeliveryHeaders, Buyer, Consignee, HSN, Ta
  // --- POST handler only ---
  this.on('CREATE', billingDocument, async (req) => {
    const { BillingDocument: billingDocumentId } = req.data;
    if (!billingDocumentId)
      return req.reject(400, 'A "BillingDocument" ID must be provided for POST.');
    try {
      const url = `${ABAP_API_URL}('${encodeURIComponent(
        billingDocumentId
      )}')?$expand=_Item,_Text&$format=json`;
      const response = await axios.get(url, axiosConfig);
      if (!response.data)
        return req.reject(404, `Billing Document '${billingDocumentId}' not found.`);
      return await mapBillingData(response.data.d || response.data, req);
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      req.reject(
        err.response?.status || 502,
        `Error fetching data from remote system: ${errorMsg}`
      );
    }
  });
};
