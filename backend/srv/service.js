const cds = require("@sap/cds");
const axios = require("axios");
require("dotenv").config();
const formatSAPDate = require("./utils/formatDate");
const stateCodeMap = require("./utils/stateCodeMap");
const { toWords } = require("./utils/numberToWords.js"); // adjust path if needed


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
    irn_details,
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
  const fetchPricingElements = async (item) => {
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
        totalPacking = 0,
        Packing = 0,
        Freight = 0,
        Insurance = 0;
      let dis = 0,
        roundOff = 0;
      const amount = Number(item.NetAmount) || 0;

      results.forEach((pe) => {
        const rateValue = Number(pe.ConditionRateValue || 0);
        const amountValue = Number(pe.ConditionAmount || 0);

        if (pe.ConditionType === "ZPAC") totalPacking = rateValue;
        if (pe.ConditionType === "ZFRE") totalFreight = rateValue;
        if (pe.ConditionType === "ZINS") totalInsurance = rateValue;
        if (pe.ConditionType === "ZPAC") Packing = amountValue;
        if (pe.ConditionType === "ZFRE") Freight = amountValue;
        if (pe.ConditionType === "ZINS") Insurance = amountValue;
        if (pe.ConditionType === "ZVAL") BaseAmount = amountValue;

        console.log({ Freight });

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
            break; // total discount
          case "ZROF":
            roundOff += amountValue;
            break; // total round-off
        }
      });

      // ✅ Correct TaxableAmount: base amount + charges - discount
      const TaxableAmount = BaseAmount + Insurance + Freight + Packing + dis;
      console.log({ BaseAmount });

      const igstRate = (TaxableAmount * igst) / 100;
      const cgstRate = (TaxableAmount * cgst) / 100;
      const sgstRate = (TaxableAmount * sgst) / 100;
      const ugstRate = (TaxableAmount * ugst) / 100;

      const finalGstRate = igstRate + cgstRate + sgstRate + ugstRate;

      // ✅ Correct Grand Total
      const GrandTotal =
        TaxableAmount + igstRate + cgstRate + sgstRate + ugstRate + roundOff;

      console.log(
        `Subtotal for item ${item.BillingDocumentItem}: ${TaxableAmount}`
      );
      console.log(
        `amount=${amount}, ins=${totalInsurance}, fre=${totalFreight}, pack=${totalPacking}, dis=${dis}`
      );

      return {
        BillingDocumentItem: item.BillingDocumentItem,
        BaseAmount,
        TaxableAmount,
        igst,
        cgst,
        sgst,
        ugst,
        igstRate,
        cgstRate,
        sgstRate,
        ugstRate,
        dis,
        Freight,
        totalPacking,
        totalFreight,
        totalInsurance,
        roundOff,
        GrandTotal,
        finalGstRate,
      };
    } catch (err) {
      console.error(
        `Error fetching pricing elements for ${item.BillingDocumentItem}:`,
        err.message
      );
      return {
        BillingDocumentItem: item.BillingDocumentItem,
        igst: 0,
        cgst: 0,
        sgst: 0,
        ugst: 0,
        totalFreight: 0,
        totalInsurance: 0,
        totalPacking: 0,
        roundOff: 0,
        BaseAmount: Number(item.NetAmount) || 0,
        dis: 0,
        TaxableAmount: Number(item.NetAmount) || 0,
        GrandTotal: Number(item.NetAmount) || 0,
        taxable: Number(item.NetAmount) || 0,
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
      BillingDocumentItem: item.BillingDocumentItem,
      ItemCategory: item.SalesDocumentItemCategory,
      SalesDocumentItemType: item.SalesDocumentItemType,
      SalesDocument: item.SalesDocument,
      ReferenceSDDocument: item.ReferenceSDDocument,
      Description: item.BillingDocumentItemText,
      Batch: item.Batch,
      quantity: item.BillingQuantity,
      unit: item.BillingQuantityUnit,
      amount: Number(item.NetAmount) || 0,
      rate: Number(item.BillingQuantity)
        ? Number(item.NetAmount) / Number(item.BillingQuantity)
        : 0,
    }));

    // Calculate total base amount (sum of item NetAmount)
    const TotalAmount = Items.reduce((sum, item) => sum + item.amount, 0);

    // Fetch pricing for each item
    const pricingPromises = itemsRaw.map((item) => fetchPricingElements(item));
    const resolvedPricing = await Promise.all(pricingPromises);

    // Flatten the results
    const PricingElements = resolvedPricing.flat();

    // Compute totals across all items
    const totalDiscount = PricingElements.reduce(
      (sum, pe) => sum + (pe.dis || 0),
      0
    );
    const totalRoundOff = PricingElements.reduce(
      (sum, pe) => sum + (pe.roundOff || 0),
      0
    );
    const totalPacking = PricingElements.reduce(
      (sum, pe) => sum + (pe.totalPacking || 0),
      0
    );
    const totalFreight = PricingElements.reduce(
      (sum, pe) => sum + (pe.totalFreight || 0),
      0
    );
    const totalInsurance = PricingElements.reduce(
      (sum, pe) => sum + (pe.totalInsurance || 0),
      0
    );
    const overalTaxableAmount = PricingElements.reduce(
      (sum, pe) => sum + (pe.TaxableAmount || 0),
      0
    );
    const overallGrandTotal = PricingElements.reduce(
      (sum, pe) => sum + (pe.GrandTotal || 0),
      0
    );
    const GrandTotalInWords = toWords(Math.floor(overallGrandTotal || 0)) + " Rupees Only"
    const overallIgst = PricingElements.reduce(
      (sum, pe) => sum + (pe.igstRate || 0),
      0
    );
    const overallsgst = PricingElements.reduce(
      (sum, pe) => sum + (pe.sgstRate || 0),
      0
    );
    const overallcgst = PricingElements.reduce(
      (sum, pe) => sum + (pe.cgstRate || 0),
      0
    );
    const overalugst = PricingElements.reduce(
      (sum, pe) => sum + (pe.ugstRate || 0),
      0
    );

    const overallGST = overalugst + overallcgst + overallsgst + overallIgst;
    const GstInWords = toWords(Math.floor(overallGST || 0)) + " Rupees Only"

    console.log("== Aggregated Totals ==");
    console.log("Total Discount:", totalDiscount);
    console.log("Total RoundOff:", totalRoundOff);
    console.log("Overall TaxableAmount:", overalTaxableAmount);
    console.log("Overall GrandTotal:", overallGrandTotal);
    console.log("Overall GrandTotal:", GrandTotalInWords);
    console.log("Overall GST:", overallGST);

    // Attach global totals to each pricing element if needed
    PricingElements.forEach((pe) => {
      pe.totalDiscount = totalDiscount;
      pe.totalRoundOff = totalRoundOff;
      pe.overalTaxableAmount = overalTaxableAmount;
      pe.overallGrandTotal = overallGrandTotal;
      pe.overallIgst = overallIgst;
      pe.overallsgst = overallsgst;
      pe.overallcgst = overallcgst;
      pe.overalugst = overalugst;
      pe.overallGST = overallGST;
      pe.GstInWords = GstInWords;
      pe.GrandTotalInWords = GrandTotalInWords;
    });

    return {
      Items,
      PricingElements,
      totalDiscount,
      totalRoundOff,
      totalPacking,
      totalFreight,
      totalInsurance,
      overalTaxableAmount,
      overallGrandTotal,
      GrandTotalInWords,
      GstInWords
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

    const { Items, PricingElements, overallGrandTotal } =
      await mapItemsAndPricing(itemsRaw);

    BillingDocument.TotalAmount = Items.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    BillingDocument.GrandTotal = overallGrandTotal;

    //IRN

    // ───────────────────────────────────────────────────────────────────────────
    // ANCHOR - 11) IRN FETCH (best-effort)
    // ───────────────────────────────────────────────────────────────────────────

    let irnData = {
      irnNumber: null,
      acknowledgementNumber: null,
      acknowledgementDate: null,
      irnStatus: null,
      cancellationDate: null,
      einvoiceSignedJson: null,
      einvoiceSignedQr: null,
      createdBy: null,
      createdDate: null,
      createdTime: null,
      officialDocumentNumber: null,
      documentYear: null,
      documentType: null,
      companyCode: null,
      version: null,
      eWayBillNo: null,
    };

    if (BillingDocument && BillingDocument.billingDocumentID) {
      try {
        const auth = {
          username: process.env.ABAP_USER,
          password: process.env.ABAP_PASS,
        };
        const irnResponse = await axios.get(
          `${irn_details}?$filter=Docno eq '${BillingDocument.billingDocumentID}'&$format=json`,
          { auth, headers: { "Content-Type": "application/json" } }
        );
        const irnRecords = irnResponse?.data?.value;
        if (Array.isArray(irnRecords) && irnRecords.length > 0) {
          const irn = irnRecords[0];
          irnData = {
            irnNumber: irn.Irn || null,
            acknowledgementNumber: irn.AckNo || null,
            acknowledgementDate: irn.AckDate || null,
            irnStatus: irn.IrnStatus || null,
            cancellationDate: irn.CancelDate || null,
            einvoiceSignedJson: irn.SignedInv || null,
            einvoiceSignedQr: irn.SignedQrcode || null,
            createdBy: irn.Ernam || null,
            createdDate: irn.Erdat || null,
            createdTime: irn.Erzet || null,
            officialDocumentNumber: irn.Odn || null,
            documentYear: irn.DocYear || null,
            documentType: irn.DocType || null,
            companyCode: irn.Bukrs || null,
            version: irn.Version || null,
            eWayBillNo: irn.ebillno || null,
          };
        }
      } catch (err) {
        console.warn("⚠️ Failed to fetch IRN data:", err.message);
      }
    }

    //fetch sales order
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
  let plantData = {
    Plant: null,
    PlantName: null,
    StreetName: null,
    HouseNumber: null,
    CityName: null,
    PostalCode: null,
    Region: null,
    Country: null,
    BusinessPlace: null,
    subjectToJurisdiction: null,
  };

  if (id) {
    try {
      const auth = {
        username: process.env.ABAP_USER,
        password: process.env.ABAP_PASS,
      };

      const response = await axios.get(
        `${ZI_PLANT1_API_URL}?$filter=Plant eq '${id}'&$format=json`,
        { auth, headers: { "Content-Type": "application/json" } }
      );

      const records = response?.data?.value;
      if (Array.isArray(records) && records.length > 0) {
        const plant = records[0];
        const regionName = stateCodeMap[plant.Region]?.name || plant.Region;

        plantData = {
          Plant: plant.Plant || null,
          PlantName: plant.PlantName || null,
          StreetName: plant.StreetName || null,
          HouseNumber: plant.HouseNumber || null,
          CityName: plant.CityName || null,
          PostalCode: plant.PostalCode || null,
          // Region: regionName || null,
          Country: plant.Country || null,
          State: stateCodeMap[plant.Region],
          BusinessPlace: plant.BusinessPlace || null,
          subjectToJurisdiction: regionName
            ? `SUBJECT TO ${regionName.toUpperCase()} JURISDICTION`
            : null,
        };
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch plant data for ${id}:`, err.message);
    }
  }

  return plantData;
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
    const HSN = hsnResults.filter(Boolean).map((h) => ({
      Product: h.Product,
      Plant: h.Plant,
      HSN: h.ConsumptionTaxCtrlCode || null,
    }));
    const DeliveryHeaders = rawHeaderResults
      .flat()
      .filter(Boolean)
      .map((dh) => ({
        DeliveryDocument: dh.DeliveryDocument,
        ShipToParty: dh.ShipToParty,
        SoldToParty: dh.SoldToParty,
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
          BusinessPartner: p.BusinessPartner,
          FullName: p.FullName,
          HouseNumber: p.HouseNumber,
          StreetName: p.StreetName,
          StreetPrefixName: p.StreetPrefixName,
          AdditionalStreetPrefixName: p.AdditionalStreetPrefixName,
          CityName: p.CityName,
          CompanyPostalCode: p.CompanyPostalCode,
          Country: p.Country,
          Region: stateCodeMap[p.Region],
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
      SalesOrder: so.SalesOrder,
      PurchaseOrderByCustomer: so.PurchaseOrderByCustomer,
      CustomerPurchaseOrderDate: formatSAPDate(so.CustomerPurchaseOrderDate),
    }));

    let copyLabels = [];
    copyLabels = [
      "Original for Recipient",
      "Duplicate for Transporter",
      "Triplicate for Supplier",
      "Extra Copy", // aka Accounts Copy / Extra Copy (internal)
    ];



    let seller = {
      name: "MERIT POLYMERS PRIVATE LIMITED",
      address: "", // filled via Plant service (if available)
      gstin: null,
      state: null,
      stateCode: null,
      email: "sales@meritpolymers.com",
      pan: "AAOCM3634M",
      bankDetails: {
        accountHolder: "Merit Polymers Private Limited",
        bank: "Kotak Mahindra Bank (India)",
        accountNumber: "7945133213",
        branchIFSC: "BORIVALI & KKBK0000653",
      },
    };

    console.log(
      BillingDocument,
      Items,
      PricingElements,
      SalesOrders,
      DeliveryItems,
      Plants,
      DeliveryHeaders,
      Buyer,
      Consignee,
      HSN,
      Tax,
      irnData,
      seller,
      copyLabels
    );

    return {
      BillingDocument,
      Items,
      PricingElements,
      SalesOrders,
      DeliveryItems,
      Plants,
      DeliveryHeaders,
      Buyer,
      Consignee,
      HSN,
      Tax,
      irnData,
      seller,
      copyLabels,
    };
  };

  // --- READ ---
  this.on("READ", billingDocument, async (req) => {
    try {
      const billingDocumentId =
        req.params?.[0] || req.query?.SELECT?.from?.ref?.[0]?.where?.[2]?.val;

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
