import React, { useMemo, useRef } from "react";
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
  Table,
  Th,
  Thead,
  Tbody,
  Tr,
  Td,
  HStack,
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

const TaxInvoiceModal = ({ isOpen, onClose, selectedDoc = {} }) => {
  // Ref for PDF download from InvoiceModal
  const invoiceRef = useRef(null);

  // 🔹 Generate QR dynamically from backend field

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
            ref={invoiceRef}
            bg="white.100"
            p={4}
            maxW="1000px"
            width="100%"
            mx="auto"
            maxHeight="70vh"
            overflowY="auto"
          >
            {finalCopyLabels.map((label, index) => (
              <Box
                key={index}
                className="invoice-page"
                bg="white"
                color="black"
                p={4}
                fontSize="sm"
                width="100%"
                mx="auto"
                mb={8}
                sx={{
                  "page-break-after": "always",
                  "&:last-child": { "page-break-after": "unset", mb: 0 },
                }}
              >
                {/* ✅ Row 2: Logo + Seller Info + QR Box */}
                <Box border="1px" borderColor="black" p={3} mb={0}>
                  <Flex align="flex-start" justify="space-between">
                    {/* Centre: Seller Info */}
                    <Box textAlign="center" flex="1">
                      <Text
                        fontSize="2xl"
                        fontWeight="bold"
                        textTransform="uppercase"
                      >
                        {plants?.PlantName || "Seller"}
                      </Text>

                      <Text fontSize="xs" fontWeight="bold">
                        {plants?.StreetName
                          ? `${plants.StreetName}${
                              plants.HouseNumber
                                ? ", " + plants.HouseNumber
                                : ""
                            }, `
                          : ""}
                        {plants?.CityName || ""} {plants?.PostalCode || ""}
                      </Text>

                      <Text fontSize="xs" fontWeight="bold">
                        State: {plants?.State?.name || "-"}
                      </Text>

                      <Text fontSize="xs" fontWeight="bold">
                        Phone No: 022-68152800
                      </Text>
                      <Text fontSize="xs" fontWeight="bold">
                        GSTIN: {Tax?.GST || "-"}
                      </Text>
                    </Box>
                  </Flex>
                </Box>
                <Box
                  border="1px solid black"
                  textAlign="center"
                  flex="1"
                  minH="20px" // Ensures fixed height even if empty
                  display="flex" // Centers content vertically & horizontally
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontSize="2xl"
                    fontWeight="bold"
                    textTransform="uppercase"
                  ></Text>
                </Box>

                <Box bg="skyblue" border="1px" textAlign="center" flex="1">
                  <Text fontSize="3xl" fontWeight="bold">
                    Tax Invoice
                  </Text>
                </Box>

                {/* ✅ Main Content Grid Box (Sticks to Above Border) */}
                <Box mt={0} border="1px" borderColor="black" fontSize="sm">
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
                      <Box border="1px solid black" flex="1">
                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Invoice No: {val(billing?.BillingDocument)}
                          </Text>
                        </Flex>

                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Invoice date: {val(billing?.BillingDocumentDate)}
                          </Text>
                        </Flex>
                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Reverse Charge (Y/N):
                          </Text>
                        </Flex>

                        <Flex p={0} textAlign="center">
                          <Box
                            minWidth="80"
                            flex="1"
                            borderRight="1px solid black"
                            p={2}
                          >
                            <Text fontWeight="bold">
                              State:{" "}
                              {plants?.State?.name || "-"}
                            </Text>
                          </Box>

                          <Box flex="1" borderRight="1px solid black" p={2}>
                            <Text fontWeight="bold">Code:</Text>
                          </Box>

                          <Box flex="1" p={2}>
                            <Text fontWeight="bold">{plants?.State?.code || "-"}</Text>
                          </Box>
                        </Flex>
                      </Box>
                    </Box>

                    {/* Right Cell (Invoice Details Grid) */}
                    <Box
                      flex="1"
                      display="flex"
                      flexDirection="column"
                      height="100%"
                    >
                      <Box flex="1">
                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Transport Mode:
                          </Text>
                        </Flex>

                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Vehicle no:
                          </Text>
                        </Flex>
                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Date of supply:
                          </Text>
                        </Flex>

                        <Flex bordertop="1px" p={0} textAlign="left">
                          <Box minWidth="80" flex="1" p={2}>
                            <Text fontWeight="bold">Place of supply: </Text>
                          </Box>
                        </Flex>
                      </Box>
                    </Box>
                  </Flex>

                  <Flex border="1px" p={0} textAlign="left">
                    <Box bordertop="1px" minWidth="80" flex="1" p={3}>
                      <Text fontWeight="bold"> </Text>
                    </Box>
                  </Flex>

                  <Flex alignItems="stretch">
                    {/* Left Cell */}
                    <Box
                      flex="1"
                      borderRight="1px solid black"
                      display="flex"
                      flexDirection="column"
                    >
                      <Box
                        border="1px solid black"
                        flex="1"
                        display="flex"
                        flexDirection="column"
                      >
                        <Flex bg="skyblue" borderBottom="1px solid black" p={2}>
                          <Text textAlign="center" fontWeight="bold" flex="1">
                            Bill to Party
                          </Text>
                        </Flex>

                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Name: {val(buyer?.FullName || buyer?.name)}
                          </Text>
                        </Flex>

                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Address:{" "}
                            {buyer?.StreetName || buyer?.StreetPrefixName
                              ? `${
                                  buyer?.StreetName || buyer?.StreetPrefixName
                                }${
                                  buyer?.HouseNumber
                                    ? ", " + buyer?.HouseNumber
                                    : ""
                                }, ${buyer?.CityName || ""}, ${
                                  buyer?.StateName || ""
                                } ${buyer?.PostalCode || ""}`
                              : "-"}
                          </Text>
                        </Flex>

                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            GSTIN: {val(buyer?.GSTIN)}
                          </Text>
                        </Flex>

                        {/* State & Code Row */}
                        <Flex flex="1" p={0}>
                          {/* State - 60% */}
                          <Box flex="0.6" borderRight="1px solid black" p={2}>
                            <Text fontWeight="bold">
                              State: {buyer?.Region?.name || "-"}
                            </Text>
                          </Box>

                          {/* Code - 40% split into label and value */}
                          <Box flex="0.2" borderRight="1px solid black" p={2}>
                            <Text fontWeight="bold">Code:</Text>
                          </Box>
                          <Box flex="0.2" p={2}>
                            <Text fontWeight="bold">
                              {buyer?.Region?.code || "-"}
                            </Text>
                          </Box>
                        </Flex>
                      </Box>
                    </Box>

                    {/* Right Cell */}
                    <Box flex="1" display="flex" flexDirection="column">
                      <Box
                        border="1px solid black"
                        flex="1"
                        display="flex"
                        flexDirection="column"
                      >
                        <Flex bg="skyblue" borderBottom="1px solid black" p={2}>
                          <Text textAlign="center" fontWeight="bold" flex="1">
                            Ship to Party
                          </Text>
                        </Flex>

                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Name: {val(consignee?.FullName || consignee?.name)}
                          </Text>
                        </Flex>

                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            Address:{" "}
                            {consignee?.StreetName ||
                            consignee?.StreetPrefixName
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
                        </Flex>

                        <Flex borderBottom="1px solid black" p={2}>
                          <Text fontWeight="bold" flex="1">
                            GSTIN: {val(consignee?.GSTIN)}
                          </Text>
                        </Flex>

                        {/* State & Code Row */}
                        <Flex flex="1" p={0}>
                          {/* State - 60% */}
                          <Box flex="0.6" borderRight="1px solid black" p={2}>
                            <Text fontWeight="bold">
                              State: {consignee?.Region?.name || "-"}
                            </Text>
                          </Box>

                          {/* Code - 40% split into label and value */}
                          <Box flex="0.2" borderRight="1px solid black" p={2}>
                            <Text fontWeight="bold">Code:</Text>
                          </Box>
                          <Box flex="0.2" p={2}>
                            <Text fontWeight="bold">
                              {consignee?.Region?.code || "-"}
                            </Text>
                          </Box>
                        </Flex>
                      </Box>
                    </Box>
                  </Flex>
                  <Flex border="1px" p={0} textAlign="left">
                    <Box bordertop="1px" minWidth="80" flex="1" p={3}>
                      <Text fontWeight="bold"> </Text>
                    </Box>
                  </Flex>

                  {/* Row 2: Items Table */}
                  <Flex
                    direction="column"
                    borderTop="1px"
                    borderColor="black"
                    w="100%"
                  >
                    {/* === HEADER ROW 1 === */}
                    <Flex
                      bg="skyblue"
                      fontWeight="bold"
                      borderBottom="1px solid black"
                    >
                      {[
                        "Sr.No",
                        "Product Description",
                        "HSN Code",
                        "Qty",
                        "Rate",
                        "Amount",
                        "Discount",
                       "Taxable Amount",
                      ].map((head, i) => (
                        <Box
                          key={i}
                          flex="1"
                          textAlign="center"
                          borderRight="1px solid black"
                          p={2}
                        >
                          {head}
                        </Box>
                      ))}

                      {/* Dynamic GST Header */}
                      {pricingElements.some((pe) => pe.igst !== 0) && (
                        <Box
                          flex="2"
                          textAlign="center"
                          borderRight="1px solid black"
                          p={2}
                        >
                          IGST
                        </Box>
                      )}
                      {pricingElements.some(
                        (pe) => pe.cgst !== 0 && pe.sgst !== 0
                      ) && (
                        <Box
                          flex="2"
                          textAlign="center"
                          borderRight="1px solid black"
                          p={2}
                        >
                          CGST + SGST
                        </Box>
                      )}
                      {pricingElements.some(
                        (pe) => pe.cgst !== 0 && pe.ugst !== 0
                      ) && (
                        <Box
                          flex="2"
                          textAlign="center"
                          borderRight="1px solid black"
                          p={2}
                        >
                          CGST + UGST
                        </Box>
                      )}
                             <Box
                          flex="2"
                          textAlign="center"
                          borderRight="1px solid black"
                          p={2}
                        >
                          CGST + UGST
                        </Box>

                      <Box flex="1" textAlign="center" p={2}>
                        Total
                      </Box>
                    </Flex>

                    {/* === HEADER ROW 2 (Rate + Amount under GST headers) === */}

                    {/* === BODY ROWS === */}
                    {items.length > 0 ? (
                      items.map((item, index) => {
                        const pe = pricingElements[index] || {};
                        return (
                          <Flex key={index} borderBottom="1px solid black">
                            <Box
                              flex="1"
                              borderRight="1px solid black"
                              textAlign="center"
                              p={2}
                            >
                              {index + 1}
                            </Box>

                            <Box
                              flex="1"
                              borderRight="1px solid black"
                              textAlign="center"
                              p={2}
                            >
                              <Text>{item.raw.Description || "-"}</Text>
                              {item.batches.map((b, i) => (
                                <Text key={i}>Batch: {b.batch || "-"}</Text>
                              ))}
                            </Box>

                            <Box
                              flex="1"
                              borderRight="1px solid black"
                              textAlign="center"
                              p={2}
                            >
                              {HSN.HSN || ""}
                            </Box>
                            <Box
                              flex="1"
                              borderRight="1px solid black"
                              textAlign="center"
                              p={2}
                            >
                              {item.qty || "-"} {item.baseUnit || ""}
                            </Box>
                            <Box
                              flex="1"
                              borderRight="1px solid black"
                              textAlign="center"
                              p={2}
                            >
                              {item.rate || "-"}
                            </Box>
                            <Box
                              flex="1"
                              borderRight="1px solid black"
                              textAlign="center"
                              p={2}
                            >
                              {item.amount || "-"}
                            </Box>
                            <Box
                              flex="1"
                              borderRight="1px solid black"
                              textAlign="center"
                              p={2}
                            >
                              {pe.dis ?? "-"}
                            </Box>
                            <Box
                              flex="1"
                              borderRight="1px solid black"
                              textAlign="center"
                              p={2}
                            >
                              {pe.TaxableAmount ?? "-"}
                            </Box>

                            {/* IGST */}
                            {pe.igst !== 0 && (
                              <>
                                <Box
                                  flex="1"
                                  borderRight="1px solid black"
                                  textAlign="center"
                                  p={2}
                                >
                                  {pe.igstRate}
                                </Box>
                                <Box
                                  flex="1"
                                  borderRight="1px solid black"
                                  textAlign="center"
                                  p={2}
                                >
                                  {pe.igst}
                                </Box>
                              </>
                            )}

                            {/* CGST + SGST */}
                            {pe.cgst !== 0 && pe.sgst !== 0 && (
                              <>
                                <Box
                                  flex="1"
                                  borderRight="1px solid black"
                                  textAlign="center"
                                  p={2}
                                >
                                  {pe.cgstRate + pe.sgstRate}
                                </Box>
                                <Box
                                  flex="1"
                                  borderRight="1px solid black"
                                  textAlign="center"
                                  p={2}
                                >
                                  {pe.cgst + pe.sgst}
                                </Box>
                              </>
                            )}

                            {/* CGST + UGST */}
                            {pe.cgst !== 0 && pe.ugst !== 0 && (
                              <>
                                <Box
                                  flex="1"
                                  borderRight="1px solid black"
                                  textAlign="center"
                                  p={2}
                                >
                                  {pe.cgstRate + pe.ugstRate}
                                </Box>
                                <Box
                                  flex="1"
                                  borderRight="1px solid black"
                                  textAlign="center"
                                  p={2}
                                >
                                  {pe.cgst + pe.ugst}
                                </Box>
                              </>
                            )}

                            <Box flex="1" textAlign="center" p={2}>
                              {pe.GrandTotal || "-"}
                            </Box>
                          </Flex>
                        );
                      })
                    ) : (
                      <Flex borderBottom="1px solid black">
                        <Box flex="1" textAlign="center" p={2}>
                          No items available
                        </Box>
                      </Flex>
                    )}

                    {/* === TOTAL ROW === */}
                    {pricingElements.length > 0 && (
                      <Flex borderTop="1px solid black" fontWeight="bold">
                        <Box
                          flex="3"
                          bg="skyblue"
                          textAlign="center"
                          borderRight="1px solid black"
                          p={2}
                        >
                          Total
                        </Box>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <Box
                            key={i}
                            flex="1"
                            borderRight="1px solid black"
                            textAlign="center"
                            p={2}
                          >
                            {i === 7 && pricingElements[0].overallGrandTotal}
                          </Box>
                        ))}
                      </Flex>
                    )}
                  </Flex>

                  {/* Second Table (Totals) */}
                  <Flex borderTop="1px" alignItems="stretch">
                    {/* Left Cell */}
                    <Box flex="8" display="flex" flexDirection="column">
                      <Flex bg="skyblue" borderBottom="1px solid black" p={2}>
                        <Text textAlign="center" fontWeight="bold" flex="1">
                          Total Value of Goods (In Figures):{" "}
                        </Text>
                      </Flex>

                      <Flex p={2}>
                        <Text
                          textAlign="center"
                          fontWeight="bold"
                          flex="1"
                        ></Text>
                      </Flex>

                      <Flex borderBottom="1px solid black" p={4}>
                        <Text textAlign="center" fontWeight="bold" flex="1">
                          {totals?.GrandTotalInWords || "N/A"}
                        </Text>
                      </Flex>
                    </Box>

                    {/* Right Cell */}
                    <Box flex="3" display="flex" flexDirection="column">
                      <Box
                        border="1px solid black"
                        flex="1"
                        display="flex"
                        flexDirection="column"
                      >
                        <Flex borderBottom="1px solid black" p={2}>
                          <Text textAlign="left" fontWeight="bold" flex="1">
                            Total Amount befre Tax :
                          </Text>
                        </Flex>

                        <Flex
                          borderBottom="1px solid black"
                          fontWeight={"bold"}
                        >
                          {pricingElements.some((pe) => pe.igst !== 0) && (
                            <Box flex="1" p={2}>
                              IGST
                            </Box>
                          )}
                          {pricingElements.some(
                            (pe) => pe.cgst !== 0 && pe.sgst !== 0
                          ) && (
                            <Box flex="1" p={2}>
                              CGST + SGST
                            </Box>
                          )}
                          {pricingElements.some(
                            (pe) => pe.cgst !== 0 && pe.ugst !== 0
                          ) && (
                            <Box flex="1" p={2}>
                              CGST + UGST
                            </Box>
                          )}
                        </Flex>

                        <Text textAlign="left" fontWeight="bold" flex="1">
                          Total Amount after Tax :
                        </Text>
                      </Box>
                    </Box>

                    <Box
                      border="1px solid black"
                      flex="2"
                      display="flex"
                      flexDirection="column"
                    >
                      <Flex borderBottom="1px solid black" p={2}>
                        <Text textAlign="center" fontWeight="bold" flex="1">
                          {pricingElements[0]?.TaxableAmount}
                        </Text>
                      </Flex>

                      <Flex borderBottom="1px solid black" p={2}>
                        <Text textAlign="center" fontWeight="bold" flex="1">
                          {pricingElements[0]?.overallGST}
                        </Text>
                      </Flex>

                      <Text textAlign="center" fontWeight="bold" flex="1">
                        {pricingElements[0]?.overallGrandTotal}
                      </Text>
                    </Box>
                  </Flex>

                  {/* Row 4: Footer Section */}

                  <Flex border="1px solid black" w="100%" fontSize="sm">
                    {/* Left Cell: Bank Details */}
                    <Box flex="6" borderRight="1px solid black" p={0}>
                      {/* Header */}
                      <Text
                        fontWeight="bold"
                        textAlign="center"
                        borderBottom="1px solid black"
                        p={1}
                        bg="skyblue"
                      >
                        Bank Details
                      </Text>

                      {/* Account Number */}
                      <Flex borderBottom="1px solid black">
                        <Box flex="1" borderRight="1px solid black" p={1}>
                          <Text fontWeight="bold">A/c No.</Text>
                        </Box>
                        <Box flex="2" p={1}>
                          <Text>
                            {val(
                              selectedDoc?.seller?.bankDetails?.accountNumber
                            )}
                          </Text>
                        </Box>
                      </Flex>

                      {/* Branch & IFSC */}
                      <Flex borderBottom="1px solid black">
                        <Box flex="1" borderRight="1px solid black" p={1}>
                          <Text fontWeight="bold">Branch & IFS Code</Text>
                        </Box>
                        <Box flex="2" p={1}>
                          <Text>
                            {val(selectedDoc?.seller?.bankDetails?.branchIFSC)}
                          </Text>
                        </Box>
                      </Flex>

                      {/* Empty filler to match height */}
                      <Box p={1} height="80px" />
                    </Box>

                    {/* Middle Cell: Common Seal */}
                    <Box
                      flex="3"
                      borderRight="1px solid black"
                      p={0}
                      display="flex"
                      flexDirection="column"
                      justifyContent="space-between"
                      minH="180px"
                    >
                      {/* Top: empty filler (keeps header area empty) */}
                      <Box />

                      {/* Footer: Common Seal aligned with Authorised Signatory */}
                      <Box p={1}>
                        <Box
                          borderTop="1px solid black"
                          pt={2}
                          w="100%"
                          textAlign="center"
                        >
                          <Text fontWeight="bold">Common Seal</Text>
                        </Box>
                      </Box>
                    </Box>

                    {/* Right Cell: GST on Reverse Charge + Authorised Signatory */}
                    <Box flex="6" p={0} textAlign="center">
                      {/* Header Row with value */}
                      <Flex borderBottom="1px solid black">
                        <Box
                          flex="1"
                          bg="skyblue"
                          p={1}
                          borderRight="1px solid black"
                          textAlign="left"
                        >
                          <Text fontWeight="bold">GST on Reverse Charge</Text>
                        </Box>
                        <Box flex="1" bg="white" p={1}>
                          <Text fontWeight="bold" textAlign="center"></Text>
                        </Box>
                      </Flex>

                      {/* Content */}
                      <Box p={2}>
                        <Text fontSize="xs">
                          Certified that the particulars given above are true
                          and correct
                        </Text>
                        <Text fontWeight="bold">
                          {(
                            plants?.PlantName ||
                            selectedDoc?.seller?.name ||
                            "COMPANY"
                          ).toUpperCase()}
                        </Text>
                        <Box height="80px" />
                        <Text fontWeight="bold">Authorised Signatory</Text>
                      </Box>
                    </Box>
                  </Flex>
                </Box>

                {/* Document Footer */}

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
