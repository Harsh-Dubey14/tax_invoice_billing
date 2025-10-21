const cds = require("@sap/cds");
const axios = require("axios");
require("dotenv").config();
const formatSAPDate = require("./utils/formatDate");
const stateCodeMap = require("./utils/stateCodeMap");

module.exports = async function () {
  const { billingDocument } = this.entities;
  const {
    ABAP_API_URL,ABAP_ITEM_API_URL,ABAP_USER,ABAP_PASS,SO_API_URL,INCOTERM_API_URL,DELIVERY_ITEM_API_URL,DELIVERY_HEADER_API_URL,ZI_PLANT1_API_URL,ZCE_TAX_DETAILS_API_URL,BUSINESS_PARTNER_API_URL,PRODUCT_PLANT_API_URL,
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
  // --- Fetch Pricing Elements per item ---
  const fetchPricingElements = async (
    item,
    TotalAmount = 0,
    totalDiscount = 0,
    totalRoundOff = 0
  ) => {
    try {
      const itemNumber = item.BillingDocumentItem.toString().padStart(6, "0");
      const url = `${ABAP_ITEM_API_URL}(BillingDocument='${item.BillingDocument}',BillingDocumentItem='${itemNumber}')/to_PricingElement?$format=json`;
      const res = await axios.get(url, axiosConfig);
      const results = res.data?.d?.results || [];

      let igst = 0,
        cgst = 0,
        sgst = 0,
        ugst = 0;
      let totalFreight = 0,
        totalInsurance = 0,
        totalPacking = 0;
      let dis = 0,
        roundOff = 0;
      let amount = Number(item.NetAmount) || 0;

      results.forEach((pe) => {
        const rateValue = Number(pe.ConditionRateValue || 0);
        const amountValue = Number(pe.ConditionAmount || 0);

        if (pe.ConditionType === "ZPAC") totalPacking += rateValue;
        if (pe.ConditionType === "ZFRE") totalFreight += rateValue;
        if (pe.ConditionType === "ZINS") totalInsurance += rateValue;

        switch (pe.ConditionType) {
          case "JOIG":
            igst = rateValue;
            break;
          case "JOCG":
            cgst = rateValue;
            break;
          case "JOSG":
            sgst = rateValue;
            break;
          case "JOUG":
            ugst = rateValue;
            break;
          case "ZDIS":
            dis += amountValue;
            break; // sum all discounts
          case "ZROF":
            roundOff += amountValue;
            break; // sum all round-offs
        }
      });
      
      // Subtotal before taxes
      const subtotal =
        TotalAmount +
        totalInsurance +
        totalFreight +
        totalPacking +
        totalDiscount;

      console.log({ subtotal });
      console.log(`this is subTotal${subtotal}`);
      console.log(
        `this is amount ${TotalAmount}, insuranc:${totalInsurance}, freight:${totalFreight}, packing:${totalPacking}, dis:${totalDiscount}`
      );

      const igstRate= (subtotal * igst) / 100 ;
      const cgstRate= (subtotal * cgst) / 100 ;
      const sgstRate= (subtotal * sgst) / 100 ;
      const ugstRate= (subtotal * ugst) / 100 ;

      // GrandTotal including taxes and round-off
      const GrandTotal =
        subtotal +igstRate+cgstRate+sgstRate+ugstRate+totalRoundOff;
       

        totalRoundOff;
      console.log("rof:", totalRoundOff);

      return {
        subtotal,igst,igstRate,cgst,cgstRate,sgst,sgstRate,ugst,ugstRate,totalPacking,totalFreight,totalInsurance, roundOff,TotalAmount, totalDiscount, totalRoundOff,GrandTotal,taxable:TotalAmount+totalFreight+totalDiscount,
      };
    } catch (err) {
      console.error(
        `Error fetching pricing elements for ${item.BillingDocumentItem}:`,
        err.message
      );
      return {
        igst: 0,cgst: 0,sgst: 0, ugst: 0,totalFreight: 0, totalInsurance: 0, totalPacking: 0,roundOff: 0,TotalAmount, totalDiscount: 0,totalRoundOff: 0,GrandTotal: 0,
      };
    }
  };

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

  // --- Map Items & PricingElements separately ---
  const mapItemsAndPricing = async (itemsRaw) => {
    const Items = itemsRaw.map((item) => ({
      BillingDocumentItem: item.BillingDocumentItem,ItemCategory: item.SalesDocumentItemCategory, SalesDocumentItemType: item.SalesDocumentItemType, SalesDocument: item.SalesDocument,ReferenceSDDocument: item.ReferenceSDDocument, Description: item.BillingDocumentItemText,Batch: item.Batch,
      quantity: item.BillingQuantity,unit: item.BillingQuantityUnit,amount: Number(item.NetAmount) || 0,
      rate: Number(item.BillingQuantity)
        ? Number(item.NetAmount) / Number(item.BillingQuantity)
        : 0,
    }));

    // Calculate total amount for all items
    const TotalAmount = Items.reduce((sum, item) => sum + item.amount, 0);

    // ISSUE IS HERE THAT IT IS PLACED BELOW AND ABOVE FIX CODE
    // Fetch pricing elements for each item
    const pricingPromises = itemsRaw.map((item) =>
      fetchPricingElements(item, TotalAmount, 0, 0)
    );
    const resolvedPricing = await Promise.all(pricingPromises);

    // Flatten and sum discounts/round-offs across all items if needed
    const PricingElements = resolvedPricing.flat();

    const totalDiscount = PricingElements.reduce(
      (sum, pe) => sum + (pe.dis || 0),
      0
    );
    const totalRoundOff = PricingElements.reduce(
      (sum, pe) => sum + (pe.roundOff || 0),
      0
    );

    PricingElements.forEach((pe) => (pe.totalDiscount = totalDiscount));
    PricingElements.forEach((pe) => (pe.totalRoundOff = totalRoundOff));

    console.log(`Total Discount for all items: ${totalDiscount}`);
    console.log(`Total RoundOff for all items: ${totalRoundOff}`)
   PricingElements.totalDiscount=totalDiscount;

    return { Items, PricingElements, totalDiscount, totalRoundOff};
  };

  // --- Map Full Billing Document ---
  const mapBillingData = async (header, itemsRaw, req) => {
    const BillingDocument = {
      billingDocumentID: header.BillingDocument,DocumentCategory: header.SDDocumentCategory,Division: header.Division, BillingDocument: header.BillingDocument, BillingDocumentDate: formatSAPDate(header.BillingDocumentDate), BillingDocumentType: header.BillingDocumentType, CompanyCode: header.CompanyCode, FiscalYear: header.FiscalYear,salesOrganization: header.SalesOrganization, DistributionChannel: header.DistributionChannel,invoiceNo: header.BillingDocument,invoiceDate: formatSAPDate(header.CreationDate), destinationCountry: header.Country,SoldToParty: header.SoldToParty,termsOfPayment: header.CustomerPaymentTerms || null, PaymentTermsName: null, motorVehicleNo: header.YY1_VehicleNo2_BDH,
    };
    const { Items, PricingElements } = await mapItemsAndPricing(itemsRaw);

    const TotalAmount = Items.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    // Attach TotalAmount to the BillingDocument object
    BillingDocument.TotalAmount = TotalAmount;


    const salesDocIds = [
      ...new Set(Items.map((i) => i.SalesDocument).filter(Boolean)),
    ];
    const paymentTermsCode = header.CustomerPaymentTerms;

    // --- Fetch Sales Orders & Payment Terms ---
    let salesOrdersData = [];
    try {
      const promises = [];
      if (salesDocIds.length) {
        const filterQuery = salesDocIds
          .map((id) => `SalesOrder eq '${id}'`)
          .join(" or ");
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
          .join(" or ");
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
    const plantPromises = [...plantIds].map(async (id) => {
      const data = await safeGet(
        axios.get(
          `${ZI_PLANT1_API_URL}?$filter=Plant eq '${id}'&$select=PlantName,Plant,StreetName,HouseNumber,CityName,PostalCode,Region,Country,BusinessPlace&$format=json`,
          axiosConfig
        )
      );
      if (!data || !data.length) return null;
      const plant = data[0];
      const regionName = stateCodeMap[plant.Region]?.name || plant.Region;
      return {
        ...plant,
        Region: regionName,
      };
    });
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
      .map((h) => ({
        Product: h.Product, Plant: h.Plant, HSN: h.ConsumptionTaxCtrlCode || null,
      }));
    const DeliveryHeaders = rawHeaderResults
      .flat()
      .filter(Boolean)
      .map((dh) => ({
        DeliveryDocument: dh.DeliveryDocument,ShipToParty: dh.ShipToParty,SoldToParty: dh.SoldToParty,
      }));

    // --- GST for Plant ---
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
      .map((t) => ({
        BusinessPlace: t.BusinessPlace,
        GST: t.IN_GSTIdentificationNumber,
      }));

    // --- Fetch Business Partner Details ---
    const allPartnerIds = new Set();
    DeliveryHeaders.forEach((dh) => {
      if (dh.SoldToParty) allPartnerIds.add(dh.SoldToParty);
      if (dh.ShipToParty) allPartnerIds.add(dh.ShipToParty);
    });

    const bpSelectFields =
      "BusinessPartner,FullName,HouseNumber,StreetName,StreetPrefixName,AdditionalStreetPrefixName,CityName,CompanyPostalCode,Region,Country";
    const bpPromises = [...allPartnerIds].map((id) =>
      safeGet(
        axios.get(
          `${BUSINESS_PARTNER_API_URL}('${encodeURIComponent(
            id
          )}')/to_BusinessPartnerAddress?$select=${bpSelectFields}&$format=json`,
          axiosConfig
        )
      )
    );
    const rawPartnerData = (await Promise.all(bpPromises))
      .flat()
      .filter(Boolean);
    const bpMap = new Map(
      rawPartnerData.map((p) => [
        p.BusinessPartner,
        {
          BusinessPartner: p.BusinessPartner,FullName: p.FullName,HouseNumber: p.HouseNumber,StreetName: p.StreetName,StreetPrefixName: p.StreetPrefixName,AdditionalStreetPrefixName: p.AdditionalStreetPrefixName, CityName: p.CityName, CompanyPostalCode: p.CompanyPostalCode, Country: p.Country, Region: stateCodeMap[p.Region],
        },
      ])
    );

    const gstPromises = [...allPartnerIds].map(async (bpId) => {
      try {
        const res = await axios.get(
          `${BUSINESS_PARTNER_API_URL}('${encodeURIComponent(
            bpId
          )}')/to_BusinessPartnerTax?$format=json`,
          axiosConfig
        );
        const taxes = res.data?.d?.results || res.data?.results || [];
        const gstEntry = taxes.find((t) => t.BPTaxType === "IN3");
        return { BusinessPartner: bpId, GSTIN: gstEntry?.BPTaxNumber || null };
      } catch {
        return { BusinessPartner: bpId, GSTIN: null };
      }
    });
    const gstData = await Promise.all(gstPromises);
    const gstMap = new Map(gstData.map((g) => [g.BusinessPartner, g.GSTIN]));

    const Buyer = [
      ...new Set(DeliveryHeaders.map((h) => h.SoldToParty).filter(Boolean)),
    ]
      .map((id) => {
        const data = bpMap.get(id);
        if (data) data.GSTIN = gstMap.get(id) || null;
        return data;
      })
      .filter(Boolean);
    const Consignee = [
      ...new Set(DeliveryHeaders.map((h) => h.ShipToParty).filter(Boolean)),
    ]
      .map((id) => {
        const data = bpMap.get(id);
        if (data) data.GSTIN = gstMap.get(id) || null;
        return data;
      })
      .filter(Boolean);

    const SalesOrders = salesOrdersData.map((so) => ({
      SalesOrder: so.SalesOrder,PurchaseOrderByCustomer: so.PurchaseOrderByCustomer, CustomerPurchaseOrderDate: formatSAPDate(so.CustomerPurchaseOrderDate),
    }));

    return {
      BillingDocument,Items, PricingElements, SalesOrders, DeliveryItems,Plants,DeliveryHeaders,Buyer, Consignee,HSN,Tax,
    };
  };


  // --- CREATE ---
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
