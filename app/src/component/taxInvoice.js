import React, { useMemo, useRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Box,
  Flex,
  Text,
  Image,
  Table,
  Thead,
  Tbody,
  Tfoot,
  Tr,
  Th,
  Td,
  VStack,
  HStack,
  Square,
  IconButton,
} from "@chakra-ui/react";
import { DownloadIcon } from "@chakra-ui/icons";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Helper functions from TaxInvoiceChakra
const NotAvailabaleValue = "N/A";
const val = (v) =>
  typeof v === "object"
    ? NotAvailabaleValue
    : v !== undefined && v !== null && String(v).trim() !== ""
    ? String(v)
    : NotAvailabaleValue;

const fix2 = (v) =>
  Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "0.00";

const TaxInvoiceModal = ({ isOpen, onClose, selectedDoc = {} }) => {
  // Ref for PDF download from InvoiceModal
  const invoiceRef = useRef(null);
  const [qrImage, setQrImage] = useState(null);

  // 🔹 Generate QR dynamically from backend field
  useEffect(() => {
    async function generateQr() {
      const qrString =
        selectedDoc?.document?.einvoiceSignedQr ||
        selectedDoc?.irnData?.einvoiceSignedQr;

      if (qrString) {
        try {
          const qr = await QRCode.toDataURL(qrString);
          setQrImage(qr);
        } catch (err) {
          console.error("QR generation failed:", err);
        }
      } else {
        setQrImage(null);
      }
    }
    generateQr();
  }, [selectedDoc]);

  // --- Data Processing Logic from TaxInvoiceChakra ---

  // Defensive: protect against selectedDoc === null
  selectedDoc = selectedDoc ?? {};

  // normalize a few common structures
  const buyer = selectedDoc.Buyer?.[0] || {};
  const consignee = selectedDoc.Consignee?.[0] || {};
  const itemsSrc = selectedDoc.Items || [];
  const so = selectedDoc.SalesOrders?.[0] || {};
  const HSN = selectedDoc.HSN?.[0] || {};
  const Tax = selectedDoc.Tax?.[0] || {};
  const pricingElements = selectedDoc.PricingElements || [];
  const billing = selectedDoc.BillingDocument || {};
  const plants = selectedDoc.Plants?.[0] || {};
  const peTotals = pricingElements[0] || {};

  // Use .filter(Boolean) to ensure no undefined/null items if array is just [null]
  const copyLabels = (selectedDoc?.copyLabels || []).filter(Boolean);

  // If no labels are provided, add a default one so it doesn't crash
  const finalCopyLabels =
    copyLabels.length > 0 ? copyLabels : ["Original for Recipient"];

  // build items similar to react-pdf mapping
  const items = useMemo(
    () =>
      (itemsSrc || []).map((it) => {
        const pe = pricingElements.find(
          (p) => p.BillingDocumentItem === it.BillingDocumentItem
        );
        const qty = it.quantity || it.qty || it.Quantity || 0;
        const baseAmount = pe?.BaseAmount || it.amount || 0;
        const rate = qty > 0 ? baseAmount / qty : it.rate || 0;
        const amount = baseAmount || it.amount || 0;
        const batches =
          it.batches?.length > 0
            ? it.batches.map((b) => ({ batch: b.batch || b.Batch, qty: b.qty }))
            : it.Batch
            ? [{ batch: it.Batch, qty: it.quantity }]
            : [];

        return {
          hsn: HSN?.HSN || it.HSN || it.hsn || "-",
          qty,
          baseUnit: it.unit || it.baseUnit || "",
          rate,
          amount,
          batches,
          raw: it,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(itemsSrc), JSON.stringify(pricingElements)]
  );

  const totals = {
    totalQty: items.reduce((s, it) => s + it.qty, 0),
    grandTotal: peTotals?.overallGrandTotal || 0,
    taxable: peTotals?.overalTaxableAmount || 0,
    igst: peTotals?.overallIgst || 0,
    cgst: peTotals?.overallcgst || 0,
    sgst: peTotals?.overallsgst || 0,
    ugst: peTotals?.overalugst || 0,
    roundOffZrof: peTotals?.totalRoundOff || 0,
    freight: peTotals?.totalFreight || 0,
    GstInWords: peTotals?.GstInWords || "",
    GrandTotalInWords: peTotals?.GrandTotalInWords || "",
  };
  const handleDownload = async () => {
    if (!invoiceRef.current) return;

    const pages = invoiceRef.current.querySelectorAll(".invoice-page");
    if (pages.length === 0) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i++) {
      // Capture the full content, not just the visible area
      const canvas = await html2canvas(pages[i], {
        scale: 2, // high quality
        useCORS: true,
        scrollY: -window.scrollY, // ensure off-screen content is captured
        windowWidth: document.body.scrollWidth,
        windowHeight: document.body.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");

      // Get image size
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Scale to fit within one A4 page
      const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      const x = (pageWidth - finalWidth) / 2; // center horizontally
      const y = (pageHeight - finalHeight) / 2; // center vertically

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight);
    }

    pdf.save(`Invoice_${billing?.BillingDocument || "invoice"}.pdf`);
  };

  // --- Return JSX combining Modal and Invoice Content ---
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Invoice Preview</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {/* Download Button from InvoiceModal */}
          <HStack mb={5} justify="flex-end">
            <IconButton
              icon={<DownloadIcon />}
              colorScheme="green"
              variant="outline"
              aria-label="Download PDF"
              onClick={handleDownload}
            />
          </HStack>

          {/* This Box is now the container for all invoice pages */}
          <Box
            ref={invoiceRef} // This ref is for the *container*
            bg="white.100" // Set a background for the modal body area
            p={4}
            maxW="1000px"
            width="100%"
            mx="auto" // Center the invoice area
            maxHeight="70vh" // Make the modal body scrollable
            overflowY="auto"
          >
            {/* ▼▼▼ START OF THE MAP FUNCTION ▼▼▼
              This loops over the labels and renders an invoice for each one.
            */}
            {finalCopyLabels.map((label, index) => (
              <Box
                key={index}
                className="invoice-page" // Class for PDF generator to find
                // border="1px"
                // borderColor="black"
                bg="white"
                color="black"
                p={4}
                fontSize="sm"
                width="100%"
                mx="auto" // Center the invoice page
                mb={8} // Add margin between pages in the preview
                sx={{
                  // PDF page break hints (may not work perfectly with html2canvas)
                  "page-break-after": "always",
                  "&:last-child": {
                    "page-break-after": "unset",
                    mb: 0, // No margin on the last item
                  },
                }}
              >
                {/* --- Start of original invoice content --- */}

                {/* Header */}
                <Flex mb={5} align="flex-start" position="relative">
                  {/* Left: Logo + IRN */}
                  <Box flex="1" maxW="50%">
                    <Image
                      src="/merit_logo.png"
                      alt="logo"
                      boxSize="150px"
                      objectFit="contain"
                      mb={2}
                      // Add an error fallback
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    <VStack align="start" spacing={0} fontSize="xs">
                      <Text>
                        <b>IRN: </b>
                        {val(
                          selectedDoc?.document?.irn ??
                            selectedDoc?.irnData?.irnNumber
                        )}
                      </Text>

                      <Text>
                        <Text>
                          <b>Ack No: </b>
                          {val(
                            selectedDoc?.document?.ackNo ??
                              selectedDoc?.irnData?.acknowledgementNumber
                          )}
                        </Text>
                      </Text>
                      <Text>
                        <Text>
                          <b>Ack Date: </b>
                          {val(
                            selectedDoc?.document?.ackDate ??
                              selectedDoc?.irnData?.acknowledgementDate
                          )}
                        </Text>
                      </Text>
                      <Text>
                        <Text>
                          <b>IRN Status: </b>
                          {val(
                            selectedDoc?.document?.irnStatus ??
                              selectedDoc?.irnData?.irnStatus
                          )}
                        </Text>
                      </Text>
                      <Text>
                        <Text>
                          <b>EWay BillNo: </b>
                          {val(
                            selectedDoc?.document?.eWayBillNo ??
                              selectedDoc?.irnData?.eWayBillNo
                          )}
                        </Text>
                      </Text>
                    </VStack>
                  </Box>

                  {/* Centre: Title */}
                  <Box
                    position="absolute"
                    left="0"
                    right="0"
                    textAlign="center"
                  >
                    <Text fontSize="lg" fontWeight="semibold">
                      {billing?.documentType ??
                        selectedDoc?.document?.type ??
                        "TAX INVOICE"}
                    </Text>

                    {/* ▼▼▼ MODIFIED SECTION ▼▼▼ */}
                    <Text fontSize="xs" textTransform="uppercase">
                      {label} {/* Use the label from the map */}
                    </Text>
                    {/* ▲▲▲ END OF MODIFIED SECTION ▲▲▲ */}
                  </Box>

                  {/* Right: QR */}
                  <Box
                    textAlign="center"
                    position="absolute"
                    right="0"
                    top="0"
                    p={1}
                  >
                    <Text fontSize="xs" mb={1}>
                      E-Invoice QR
                    </Text>

                    {qrImage ? (
                      <Image
                        src={qrImage}
                        alt="E-Invoice QR"
                        boxSize="200px"
                        borderWidth="1px"
                        borderColor="black"
                        borderRadius="md"
                        mx="auto"
                        mt={1} // ensures spacing between text and image
                      />
                    ) : (
                      <Square
                        size="200px"
                        borderWidth="1px"
                        borderColor="black"
                        alignItems="center"
                        justifyContent="center"
                        mx="auto"
                        mt={1}
                      >
                        <Text fontSize="xs" color="gray.600" textAlign="center">
                          QR Not Available
                        </Text>
                      </Square>
                    )}
                  </Box>
                </Flex>

                {/* Main Content Grid Box */}
                <Box mt={3} border=" 1px" borderColor="black" fontSize="sm">
                  {/* Row 1: Seller/Consignee/Buyer + Invoice Details */}
                  <Flex alignItems="stretch">
                    {/* Left Cell */}
                    <Box
                      borderRight="1px"
                      flex="1"
                      p={0}
                      display="flex"
                      flexDirection="column"
                    >
                      {/* Seller Row */}
                      <Box borderBottom="1px" p={2} flex="1">
                        <Text fontWeight="bold">
                          {plants?.PlantName || "Seller"}
                        </Text>
                        <Text fontSize="xs">
                          {plants?.StreetName
                            ? `${plants.StreetName}${
                                plants.HouseNumber
                                  ? ", " + plants.HouseNumber
                                  : ""
                              }, `
                            : ""}
                          {plants?.CityName || ""} {plants?.PostalCode || ""}
                        </Text>
                        <Text fontSize="xs">
                          State Name:{" "}
                          {plants?.Region || plants?.StateName || "-"}
                        </Text>
                        <Text fontSize="xs">GSTIN/UIN: {Tax?.GST || "-"}</Text>
                        <Text fontSize="xs">
                          E-Mail: sales@meritpolymers.com
                        </Text>
                      </Box>

                      {/* Consignee Row */}
                      <Box borderBottom="1px" p={2} flex="1">
                        <Text fontWeight="bold">Consignee (Ship To)</Text>
                        <Text>
                          {val(consignee?.FullName || consignee?.name)}
                        </Text>
                        <Text fontSize="xs">
                          {consignee?.StreetName || consignee?.StreetPrefixName
                            ? `${
                                consignee?.StreetName ||
                                consignee?.StreetPrefixName
                              }${
                                consignee?.HouseNumber
                                  ? ", " + consignee?.HouseNumber
                                  : ""
                              }, ${consignee?.CityName || ""}, ${
                                consignee?.StateName || ""
                              } ${consignee?.PostalCode || ""}`
                            : "-"}
                        </Text>
                        <Text fontSize="xs">
                          GSTIN: {val(consignee?.GSTIN)}
                        </Text>
                      </Box>

                      {/* Buyer Row */}
                      <Box p={2} flex="1">
                        <Text fontWeight="bold">Buyer (Bill To)</Text>
                        <Text>{val(buyer?.FullName || buyer?.name)}</Text>
                        <Text fontSize="xs">
                          {buyer?.StreetName || buyer?.StreetPrefixName
                            ? `${buyer?.StreetName || buyer?.StreetPrefixName}${
                                buyer?.HouseNumber
                                  ? ", " + buyer?.HouseNumber
                                  : ""
                              }, ${buyer?.CityName || ""}, ${
                                buyer?.StateName || ""
                              } ${buyer?.PostalCode || ""}`
                            : "-"}
                        </Text>
                        <Text fontSize="xs">GSTIN: {val(buyer?.GSTIN)}</Text>
                      </Box>
                    </Box>

                    {/* Right Cell (Invoice Details Grid) */}
                    <Box
                      flex="1"
                      display="flex"
                      flexDirection="column"
                      height="100%"
                    >
                      <Flex>
                        <Box width="50%" p={2}>
                          <Text fontSize="xs">Invoice No.</Text>
                          <Text fontWeight="bold" fontSize="sm">
                            {val(billing?.BillingDocument)}
                          </Text>
                        </Box>
                        <Box width="50%" borderLeft="1px" p={2}>
                          <Text fontSize="xs">Date</Text>
                          <Text fontWeight="bold" fontSize="sm">
                            {val(billing?.BillingDocumentDate)}
                          </Text>
                        </Box>
                      </Flex>

                      <Flex borderTop="1px">
                        <Box width="50%" p={2}>
                          <Text fontSize="xs">Mode/Terms of Payment</Text>
                          <Text fontWeight="bold">
                            {val(billing?.PaymentTermsName)}
                          </Text>
                        </Box>
                        <Box width="50%" borderLeft="1px" p={2}>
                          <Text fontSize="xs">Destination</Text>
                          <Text fontWeight="bold">
                            {val(
                              plants?.CityName || billing?.destinationCountry
                            )}
                          </Text>
                        </Box>
                      </Flex>

                      <Flex borderTop="1px">
                        <Box width="50%" p={2}>
                          <Text fontSize="xs"></Text>
                          <Text fontWeight="bold"></Text>
                        </Box>
                        <Box width="50%" borderLeft="1px" p={2}>
                          <Text fontSize="xs">Country</Text>
                          <Text fontWeight="bold">
                            {billing?.destinationCountry}
                          </Text>
                        </Box>
                      </Flex>

                      <Flex borderTop="1px">
                        <Box width="50%" p={2}>
                          <Text fontSize="xs">Buyer Order No</Text>
                          <Text fontWeight="bold">
                            {val(
                              so?.PurchaseOrderByCustomer || so?.PurchaseOrder
                            )}
                          </Text>
                        </Box>
                        <Box width="50%" borderLeft="1px" p={2}>
                          <Text fontSize="xs">Purchase Order Date</Text>
                          <Text fontWeight="bold">
                            {val(so?.CustomerPurchaseOrderDate)}
                          </Text>
                        </Box>
                      </Flex>

                      <Flex borderTop="1px">
                        <Box width="50%" p={2}>
                          <Text fontSize="xs">Delivery Note No</Text>
                          <Text fontWeight="bold">
                            {val(
                              selectedDoc.DeliveryItems?.[0]?.DeliveryDocument
                            )}
                          </Text>
                        </Box>
                        <Box width="50%" borderLeft="1px" p={2}>
                          <Text fontSize="xs">Delivery Note Date</Text>
                          <Text fontWeight="bold">
                            {val(billing?.BillingDocumentDate)}
                          </Text>
                        </Box>
                      </Flex>

                      <Flex borderTop="1px">
                        <Box width="50%" p={2}>
                          <Text fontSize="xs">Dispatched Through</Text>
                          <Text fontWeight="bold">Bhavna Roadways</Text>
                        </Box>
                        <Box width="50%" borderLeft="1px" p={2}>
                          <Text fontSize="xs">Motor Vehicle No</Text>
                          <Text fontWeight="bold">
                            {val(billing?.motorVehicleNo)}
                          </Text>
                        </Box>
                      </Flex>

                      {/* Billing Instructions (kept same as original) */}
                      <Flex borderTop="1px">
                        <Box
                          width="100%"
                          p={2}
                          height="100px" // ✅ double height (about twice the others)
                          minHeight="100px" // ✅ ensure it stays tall even if empty
                          display="flex"
                          flexDirection="column"
                          text="bold"
                        >
                          <Text fontSize="xs">Billing Instructions: </Text>
                          <Text fontWeight="bold"></Text>
                        </Box>
                      </Flex>
                    </Box>
                  </Flex>

                  {/* Row 2: Items Table */}
                  <Flex borderTop=" 1px">
                    <Table
                      size="sm"
                      variant="unstyled" // Using unstyled and adding borders manually
                      w="100%"
                      color="black"
                      sx={{ borderCollapse: "collapse" }} // Ensures borders are clean
                    >
                      <Tbody>
                        {/* Header Row */}
                        <Tr fontWeight="bold">
                          <Td
                            borderBottom=" 1px"
                            borderRight=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Sr.
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderRight=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Description of Goods
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderRight=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            HSN/SAC
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderRight=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Quantity
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderRight=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Rate
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Amount
                          </Td>
                        </Tr>

                        {/* Items */}
                        {items.length > 0 ? (
                          items.map((item, index) => (
                            <Tr key={index} verticalAlign="top">
                              <Td
                                borderRight=" 1px"
                                borderColor="black"
                                p={2}
                                textAlign="center"
                              >
                                {index + 1}
                              </Td>

                              <Td
                                borderRight=" 1px"
                                borderColor="black"
                                p={2}
                                textAlign="left"
                              >
                                {" "}
                                {/* Aligned left */}
                                <Text>{item.raw.Description || "-"}</Text>
                                {item.batches.length > 0 &&
                                  item.batches.map((b, i) => (
                                    <Text key={i}>Batch: {b.batch || "-"}</Text>
                                  ))}
                              </Td>

                              <Td
                                borderRight=" 1px"
                                borderColor="black"
                                p={2}
                                textAlign="center"
                              >
                                {item.hsn || "-"}
                              </Td>

                              <Td
                                borderRight=" 1px"
                                borderColor="black"
                                p={2}
                                textAlign="center"
                              >
                                {item.qty || "-"} {item.baseUnit || ""}
                              </Td>

                              <Td
                                borderRight=" 1px"
                                borderColor="black"
                                p={2}
                                textAlign="center"
                              >
                                {item.rate?.toFixed(2) || "-"}
                              </Td>

                              <Td p={2} textAlign="center">
                                {item.amount?.toFixed(2) || "-"}
                              </Td>
                            </Tr>
                          ))
                        ) : (
                          <Tr>
                            <Td colSpan={6} textAlign="center">
                              No items available
                            </Td>
                          </Tr>
                        )}

                        {/* === SUMMARY FIELDS === */}
                        {pricingElements.length > 0 && (
                          <>
                            {pricingElements[0]?.totalDiscount !== 0 && (
                              <Tr>
                                <Td borderRight=" 1px" borderColor="black"></Td>
                                <Td
                                  borderRight=" 1px"
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                >
                                  Discount
                                </Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalDiscount.toFixed(2)}
                                </Td>
                              </Tr>
                            )}
                            {pricingElements[0]?.totalFreight > 0 && (
                              <Tr>
                                <Td borderRight=" 1px" borderColor="black"></Td>
                                <Td
                                  borderRight=" 1px"
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                >
                                  Freight
                                </Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalFreight.toFixed(2)}
                                </Td>
                              </Tr>
                            )}
                            {pricingElements[0]?.totalPacking > 0 && (
                              <Tr>
                                <Td borderRight=" 1px" borderColor="black"></Td>
                                <Td
                                  borderRight=" 1px"
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                >
                                  Packing
                                </Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalPacking.toFixed(2)}
                                </Td>
                              </Tr>
                            )}
                            {pricingElements[0]?.totalInsurance > 0 && (
                              <Tr>
                                <Td borderRight=" 1px" borderColor="black"></Td>
                                <Td
                                  borderRight=" 1px"
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                >
                                  Insurance
                                </Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalInsurance.toFixed(2)}
                                </Td>
                              </Tr>
                            )}
                            {pricingElements[0]?.overalTaxableAmount > 0 && (
                              <Tr>
                                <Td borderRight=" 1px" borderColor="black"></Td>
                                <Td
                                  borderRight=" 1px"
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                >
                                  Taxable
                                </Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].overalTaxableAmount.toFixed(
                                    2
                                  )}
                                </Td>
                              </Tr>
                            )}

                            {pricingElements[0]?.overallIgst > 0 ? (
                              <Tr>
                                <Td borderRight=" 1px" borderColor="black"></Td>
                                <Td
                                  borderRight=" 1px"
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                >
                                  IGST
                                </Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].overallIgst.toFixed(2)}
                                </Td>
                              </Tr>
                            ) : (
                              <>
                                {pricingElements[0]?.overallcgst > 0 && (
                                  <Tr>
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                      p={2}
                                      textAlign="right"
                                    >
                                      CGST
                                    </Td>{" "}
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td p={2} textAlign="center">
                                      {pricingElements[0].overallcgst.toFixed(
                                        2
                                      )}
                                    </Td>
                                  </Tr>
                                )}
                                {pricingElements[0]?.overalugst > 0 && (
                                  <Tr>
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                      p={2}
                                      textAlign="right"
                                    >
                                      UGST
                                    </Td>{" "}
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td p={2} textAlign="center">
                                      {pricingElements[0].overalugst.toFixed(2)}
                                    </Td>
                                  </Tr>
                                )}
                                {pricingElements[0]?.overallsgst > 0 && (
                                  <Tr>
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                      p={2}
                                      textAlign="right"
                                    >
                                      SGST
                                    </Td>
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td
                                      borderRight=" 1px"
                                      borderColor="black"
                                    ></Td>{" "}
                                    <Td p={2} textAlign="center">
                                      {pricingElements[0].overallsgst.toFixed(
                                        2
                                      )}
                                    </Td>
                                  </Tr>
                                )}
                              </>
                            )}

                            {pricingElements[0]?.totalRoundOff !== 0 && (
                              <Tr>
                                <Td borderRight=" 1px" borderColor="black"></Td>
                                <Td
                                  borderRight=" 1px"
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                >
                                  Round Off
                                </Td>
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td borderRight=" 1px" borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalRoundOff.toFixed(2)}
                                </Td>
                              </Tr>
                            )}

                            {pricingElements[0]?.overallGrandTotal > 0 && (
                              <>
                                {/* Total Row */}
                                <Tr>
                                  <Td
                                    borderBottom="1px"
                                    borderTop="1px"
                                    borderRight="1px"
                                    borderColor="black"
                                    p={2}
                                    fontWeight="bold"
                                  >
                                    Total
                                  </Td>
                                  <Td
                                    borderBottom="1px"
                                    borderTop="1px"
                                    borderRight="1px"
                                    borderColor="black"
                                    p={2}
                                    textAlign="right"
                                  ></Td>
                                  <Td
                                    borderBottom="1px"
                                    borderTop="1px"
                                    borderRight="1px"
                                    borderColor="black"
                                  ></Td>
                                  <Td
                                    borderBottom="1px"
                                    borderTop="1px"
                                    borderRight="1px"
                                    borderColor="black"
                                  ></Td>
                                  <Td
                                    borderBottom="1px"
                                    borderTop="1px"
                                    borderRight="1px"
                                    borderColor="black"
                                  ></Td>
                                  <Td
                                    borderBottom="1px"
                                    borderTop="1px"
                                    borderColor="black"
                                    p={2}
                                    textAlign="center"
                                    fontWeight="bold"
                                  >
                                    {pricingElements[0].overallGrandTotal.toFixed(
                                      2
                                    )}
                                  </Td>
                                </Tr>
                              </>
                            )}
                          </>
                        )}
                      </Tbody>
                    </Table>
                  </Flex>

                  <Flex>
                    <Table
                      size="sm"
                      variant="unstyled"
                      sx={{ borderCollapse: "collapse" }}
                      w="100%"
                      color="black"
                    >
                      <Tbody>
                        <Tr>
                          <Td p={2} borderColor="black">
                            <Text fontWeight="bold" as="span">
                              Amount In Words:{" "}
                            </Text>
                            {totals?.GrandTotalInWords
                              ? totals.GrandTotalInWords
                              : "N/A"}
                          </Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </Flex>

                  {/* Row 3: Pricing Elements (Tax) Table */}
                  {/* Row 3: Pricing Elements (Tax) Table */}
                  <Flex flexDirection="column" w="100%">
                    {/* Pricing Table */}
                    <Flex borderTop="1px" marginTop="-1px" w="100%">
                      <Table
                        size="sm"
                        variant="simple"
                        borderCollapse="collapse"
                        w="100%"
                        mb={2}
                        color="black"
                      >
                        <Thead
                          fontWeight="bold"
                          color="black"
                          textAlign="center"
                        >
                          <Tr>
                            <Th
                              borderBottom="1px"
                              borderRight="1px"
                              rowSpan={2}
                              color="black"
                              textAlign="center"
                            >
                              HSN/SAC
                            </Th>
                            <Th
                              borderBottom="1px"
                              borderRight="1px"
                              rowSpan={2}
                              color="black"
                              textAlign="center"
                            >
                              Taxable Value
                            </Th>

                            {pricingElements.some((pe) => pe.igst !== 0) && (
                              <Th
                                borderBottom="1px"
                                borderRight="1px"
                                colSpan={2}
                                textAlign="center"
                                color="black"
                              >
                                IGST
                              </Th>
                            )}
                            {pricingElements.some((pe) => pe.cgst !== 0) && (
                              <Th
                                borderBottom="1px"
                                borderRight="1px"
                                colSpan={2}
                                textAlign="center"
                                color="black"
                              >
                                CGST
                              </Th>
                            )}
                            {pricingElements.some((pe) => pe.sgst !== 0) && (
                              <Th
                                borderBottom="1px"
                                borderRight="1px"
                                colSpan={2}
                                textAlign="center"
                                color="black"
                              >
                                SGST
                              </Th>
                            )}
                            {pricingElements.some((pe) => pe.ugst !== 0) && (
                              <Th
                                borderBottom="1px"
                                borderRight="1px"
                                colSpan={2}
                                textAlign="center"
                                color="black"
                              >
                                UGST
                              </Th>
                            )}

                            <Th
                              borderBottom="1px"
                              rowSpan={2}
                              color="black"
                              textAlign="center"
                            >
                              Total Tax Amount
                            </Th>
                          </Tr>

                          <Tr>
                            {pricingElements.some((pe) => pe.igst !== 0) && (
                              <>
                                <Th
                                  border="1px"
                                  textAlign="center"
                                  color="black"
                                >
                                  Rate
                                </Th>
                                <Th
                                  border="1px"
                                  textAlign="center"
                                  color="black"
                                >
                                  Amount
                                </Th>
                              </>
                            )}
                            {pricingElements.some((pe) => pe.cgst !== 0) && (
                              <>
                                <Th
                                  border="1px"
                                  textAlign="center"
                                  color="black"
                                >
                                  Rate
                                </Th>
                                <Th
                                  border="1px"
                                  textAlign="center"
                                  color="black"
                                >
                                  Amount
                                </Th>
                              </>
                            )}
                            {pricingElements.some((pe) => pe.sgst !== 0) && (
                              <>
                                <Th
                                  border="1px"
                                  textAlign="center"
                                  color="black"
                                >
                                  Rate
                                </Th>
                                <Th
                                  border="1px"
                                  textAlign="center"
                                  color="black"
                                >
                                  Amount
                                </Th>
                              </>
                            )}
                            {pricingElements.some((pe) => pe.ugst !== 0) && (
                              <>
                                <Th
                                  border="1px"
                                  textAlign="center"
                                  color="black"
                                >
                                  Rate
                                </Th>
                                <Th
                                  border="1px"
                                  textAlign="center"
                                  color="black"
                                >
                                  Amount
                                </Th>
                              </>
                            )}
                          </Tr>
                        </Thead>

                        <Tbody color="black">
                          {pricingElements && pricingElements.length > 0 ? (
                            pricingElements.map((pe, index) => (
                              <Tr key={index} color="black">
                                <Td
                                  borderBottom="1px"
                                  borderRight="1px"
                                  textAlign="center"
                                >
                                  {HSN.HSN ?? "-"}
                                </Td>
                                <Td border="1px" textAlign="center">
                                  {fix2(pe.TaxableAmount ?? "-")}
                                </Td>

                                {pe.igst !== 0 && (
                                  <>
                                    <Td border="1px" textAlign="center">
                                      {pe.igst}
                                    </Td>
                                    <Td border="1px" textAlign="center">
                                      {fix2(pe.igstRate)}
                                    </Td>
                                  </>
                                )}
                                {pe.cgst !== 0 && (
                                  <>
                                    <Td border="1px" textAlign="center">
                                      {pe.cgst}
                                    </Td>
                                    <Td border="1px" textAlign="center">
                                      {fix2(pe.cgstRate)}
                                    </Td>
                                  </>
                                )}
                                {pe.sgst !== 0 && (
                                  <>
                                    <Td border="1px" textAlign="center">
                                      {pe.sgst}
                                    </Td>
                                    <Td border="1px" textAlign="center">
                                      {fix2(pe.sgstRate)}
                                    </Td>
                                  </>
                                )}
                                {pe.ugst !== 0 && (
                                  <>
                                    <Td border="1px" textAlign="center">
                                      {pe.ugst}
                                    </Td>
                                    <Td border="1px" textAlign="center">
                                      {fix2(pe.ugstRate)}
                                    </Td>
                                  </>
                                )}

                                <Td borderBottom="1px" textAlign="center">
                                  {fix2(pe.finalGstRate || 0)}
                                </Td>
                              </Tr>
                            ))
                          ) : (
                            <Tr>
                              <Td border="1px" colSpan={8} textAlign="center">
                                No line item data available.
                              </Td>
                            </Tr>
                          )}
                        </Tbody>

                        <Tfoot fontWeight="bold" color="black">
                          <Tr>
                            <Td
                              borderBottom="1px"
                              borderRight="1px"
                              textAlign="center"
                            >
                              TOTAL
                            </Td>
                            <Td
                              borderBottom="1px"
                              borderRight="1px"
                              textAlign="center"
                            >
                              {fix2(
                                pricingElements[0]?.overalTaxableAmount || 0
                              )}
                            </Td>

                            {pricingElements.some((pe) => pe.igst !== 0) && (
                              <>
                                <Td border="1px" textAlign="center">
                                  —
                                </Td>
                                <Td border="1px" textAlign="center">
                                  {fix2(pricingElements[0]?.overallIgst || 0)}
                                </Td>
                              </>
                            )}
                            {pricingElements.some((pe) => pe.cgst !== 0) && (
                              <>
                                <Td border="1px" textAlign="center">
                                  —
                                </Td>
                                <Td border="1px" textAlign="center">
                                  {fix2(pricingElements[0]?.overallcgst || 0)}
                                </Td>
                              </>
                            )}
                            {pricingElements.some((pe) => pe.sgst !== 0) && (
                              <>
                                <Td border="1px" textAlign="center">
                                  —
                                </Td>
                                <Td border="1px" textAlign="center">
                                  {fix2(pricingElements[0]?.overallsgst || 0)}
                                </Td>
                              </>
                            )}
                            {pricingElements.some((pe) => pe.ugst !== 0) && (
                              <>
                                <Td border="1px" textAlign="center">
                                  —
                                </Td>
                                <Td border="1px" textAlign="center">
                                  {fix2(pricingElements[0]?.overalugst || 0)}
                                </Td>
                              </>
                            )}

                            <Td borderBottom="1px" textAlign="center">
                              {fix2(pricingElements[0]?.overallGST || 0)}
                            </Td>
                          </Tr>
                        </Tfoot>
                      </Table>
                    </Flex>
                  </Flex>
                  <Flex w="100%" mt={1}>
                    <Table
                      size="sm"
                      variant="unstyled"
                      sx={{ borderCollapse: "collapse" }}
                      w="100%"
                      color="black"
                    >
                      <Tbody>
                        <Tr>
                          <Td
                            justifyContent="center"
                            colSpan={2}
                            textAlign="left"
                            p={2}
                          >
                            <b>Total GST (in words):</b>{" "}
                            {pricingElements[0]?.GstInWords || "—"}
                          </Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </Flex>

                  {/* Row 4: Footer Section */}
                  <Flex>
                    <Box fontSize="sm" w="100%">
                      {/* Row 2: Company PAN + Declaration + Bank Details */}
                      <Flex borderTop="1px" borderBottom=" 1px">
                        {/* Left Cell */}
                        <Box flex="1" borderRight=" 1px" p={2}>
                          <Text fontWeight="bold">Company's PAN</Text>
                          <Text>{val(selectedDoc?.seller?.pan)}</Text>

                          <Text fontWeight="bold" mt={2}>
                            Declaration
                          </Text>
                          <Text fontSize="sm">
                            {val(
                              selectedDoc?.declaration ||
                                "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
                            )}
                          </Text>
                        </Box>

                        {/* Right Cell */}
                        <Box flex="1" p={2}>
                          <Text fontWeight="bold">Company's Bank Details</Text>
                          <Text>
                            A/c Holder's Name:{" "}
                            {val(
                              selectedDoc?.seller?.bankDetails?.accountHolder
                            )}
                          </Text>
                          <Text>
                            Bank Name:{" "}
                            {val(selectedDoc?.seller?.bankDetails?.bank)}
                          </Text>
                          <Text>
                            A/c No.:{" "}
                            {val(
                              selectedDoc?.seller?.bankDetails?.accountNumber
                            )}
                          </Text>
                          <Text>
                            Branch & IFS Code:{" "}
                            {val(selectedDoc?.seller?.bankDetails?.branchIFSC)}
                          </Text>
                        </Box>
                      </Flex>

                      {/* Row 3: Signature Section */}
                      <Flex>
                        {/* Left Cell */}
                        <Box flex="1" borderRight=" 1px" p={2}>
                          <Text>Customer's Seal and Signature</Text>
                        </Box>

                        {/* Right Cell */}
                        <Box flex="1" p={2} textAlign="right">
                          <Text>
                            For{" "}
                            {plants?.PlantName ||
                              selectedDoc?.seller?.name ||
                              "Company"}
                          </Text>
                          <Box height="50px" />
                          <Text>Authorised Signatory</Text>
                        </Box>
                      </Flex>
                    </Box>
                  </Flex>
                </Box>

                {/* Document Footer */}
                <Flex justify="center" align="center" mt={2}>
                  <Box textAlign="center">
                    <Text>
                      {plants.subjectToJurisdiction || "Jurisdiction: N/A"}
                    </Text>
                    <Text>
                      {selectedDoc?.document?.type === "CREDIT NOTE"
                        ? "This is a Computer Generated Document"
                        : "This is a Computer Generated Invoice"}
                    </Text>
                  </Box>
                </Flex>

                {/* --- End of original invoice content --- */}
              </Box>
            ))}
            {/* ▲▲▲ END OF THE MAP FUNCTION ▲▲▲ */}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default TaxInvoiceModal;
