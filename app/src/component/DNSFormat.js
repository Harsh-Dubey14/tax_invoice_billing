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
  Tbody,
  Tr,
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
                {/* ✅ Row 1: Tax Invoice / Jurisdiction / Copy Label */}
                <Flex align="center" justify="space-between" w="100%" mb={3}>
                  {/* Left: Invoice Title */}
                  <Box maxW="33%">
                    <Text
                      fontWeight="bold"
                      fontSize="sm"
                      textTransform="uppercase"
                    >
                      Tax Invoice
                    </Text>
                  </Box>

                  {/* Centre: Jurisdiction */}
                  <Box textAlign="center" flex="1">
                    <Text fontSize="sm">
                      <b>
                        {plants.subjectToJurisdiction || "Jurisdiction: N/A"}
                      </b>
                    </Text>
                  </Box>

                  {/* Right: Copy Label */}
                  <Box textAlign="right" maxW="33%" p={1}>
                    <Text fontSize="sm" textTransform="uppercase">
                      <b>{label}</b>
                    </Text>
                  </Box>
                </Flex>

                {/* ✅ Row 2: Logo + Seller Info + QR Box */}
                <Box border="1px" borderColor="black" p={3} mb={0}>
                  <Flex align="flex-start" justify="space-between">
                    {/* Left: Logo + IRN Info */}
                    <Box>
                      <Image
                        src="/merit_logo.png"
                        alt="logo"
                        boxSize="100px"
                        objectFit="contain"
                        mb={2}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />

                      <VStack align="start" spacing={0} fontSize="xs">
                        <Text>
                          <b>CIN :</b>
                        </Text>
                        <Text>
                          <b>Pan no:</b> {val(selectedDoc?.seller?.pan)}
                        </Text>
                        <Text>
                          <b>GSTIN:</b> {Tax?.GST || "-"}
                        </Text>
                        <Text>
                          <b>Desp Of Commodity :</b>
                        </Text>
                        <Text>
                          <b>HSN:</b> {val(HSN.HSN || HSN.hsn || "-")}
                        </Text>
                      </VStack>
                    </Box>

                    {/* Centre: Seller Info */}
                    <Box textAlign="left" flex="1">
                      <Text
                        fontSize="2xl"
                        fontWeight="bold"
                        textTransform="uppercase"
                      >
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
                        State: {plants?.State?.name || "-"}
                      </Text>
                      <Text fontSize="xs">
                        E-Mail: sales@meritpolymers.com- phone no : 022 -
                        68152800{" "}
                      </Text>
                      <Text fontSize="xs">
                        (The invoice issue under Rule 46(1) read with sec.31 of
                        CGST Act 2017){" "}
                      </Text>
                    </Box>

                    {/* Right: QR Code */}
                    <Box justifyContent="center" maxW="40%" ml="20px">
                      <Text justifyContent="center" fontSize="xs" mb={1}>
                        E-Invoice QR
                      </Text>
                      {qrImage ? (
                        <Image
                          src={qrImage}
                          alt="E-Invoice QR"
                          boxSize="150px"
                          borderWidth="1px"
                          borderColor="black"
                          borderRadius="md"
                          justifyContent="center"
                          mx="auto"
                        />
                      ) : (
                        <Square
                          size="150px"
                          borderWidth="1px"
                          borderColor="black"
                          alignItems="center"
                          justifyContent="center"
                          mx="auto"
                        >
                          <Text
                            fontSize="xs"
                            color="gray.600"
                            textAlign="center"
                          >
                            QR Not Available
                          </Text>
                        </Square>
                      )}
                    </Box>
                  </Flex>
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
                      <Box borderBottom="1px" p={2} flex="1">
                        <Text fontWeight="bold">Agent:</Text>
                        <Text fontWeight="bold">
                          Buyer Order No :{" "}
                          {val(
                            so?.PurchaseOrderByCustomer || so?.PurchaseOrder
                          )}
                        </Text>
                        <Text fontWeight="bold">Our Order No:</Text>
                      </Box>

                      {/* Consignee Row */}
                      <Box flex="1" borderBottom="1px" p={2}>
                        <Text fontWeight="bold">Company's Bank Details</Text>
                        <Text>
                          A/c Holder's Name:{" "}
                          {val(selectedDoc?.seller?.bankDetails?.accountHolder)}
                        </Text>
                        <Text>
                          Bank Name:{" "}
                          {val(selectedDoc?.seller?.bankDetails?.bank)}
                        </Text>
                        <Text>
                          A/c No.:{" "}
                          {val(selectedDoc?.seller?.bankDetails?.accountNumber)}
                        </Text>
                        <Text>
                          Branch & IFS Code:{" "}
                          {val(selectedDoc?.seller?.bankDetails?.branchIFSC)}
                        </Text>
                      </Box>

                      {/* Buyer Row */}
                      <Box
                        width="100%"
                        p={2}
                        height="100px"
                        minHeight="100px"
                        display="flex"
                        flexDirection="column"
                        text="bold"
                      >
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
                          <Text fontWeight="bold" fontSize="xs">
                            Invoice No : {val(billing?.BillingDocument)}
                          </Text>
                        </Box>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            Date : {val(billing?.BillingDocumentDate)}
                          </Text>
                        </Box>
                      </Flex>

                      <Flex>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            Challan No :
                          </Text>
                        </Box>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            Purchase Order Date :{" "}
                            {val(so?.CustomerPurchaseOrderDate)}
                          </Text>
                        </Box>
                      </Flex>

                      <Flex>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            Vehicle No : {val(billing?.motorVehicleNo)}
                          </Text>
                        </Box>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            Transport Mode :
                          </Text>
                        </Box>
                      </Flex>

                      <Flex>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            Place of Supply :
                          </Text>
                        </Box>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            Transporter :
                          </Text>
                        </Box>
                      </Flex>

                      <Flex>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            EWay BillNo :{" "}
                            {val(
                              selectedDoc?.document?.eWayBillNo ??
                                selectedDoc?.irnData?.eWayBillNo
                            )}
                          </Text>
                        </Box>
                        <Box width="50%" p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            IRN Status :{" "}
                            {val(
                              selectedDoc?.document?.irnStatus ??
                                selectedDoc?.irnData?.irnStatus
                            )}
                          </Text>
                        </Box>
                      </Flex>

                      <Flex>
                        <Box p={2}>
                          <Text fontWeight="bold" fontSize="xs">
                            IRN:{" "}
                            {val(
                              selectedDoc?.document?.irn ??
                                selectedDoc?.irnData?.irnNumber
                            )}
                          </Text>
                        </Box>
                      </Flex>

                      {/* Billing Instructions (Same Layout) */}
                      <Flex borderTop="1px">
                        <Box
                          width="100%"
                          p={2}
                          height="100px"
                          minHeight="100px"
                          display="flex"
                          flexDirection="column"
                          text="bold"
                        >
                          <Text fontWeight="bold">Consignee (Ship To)</Text>
                          <Text>
                            {val(consignee?.FullName || consignee?.name)}
                          </Text>
                          <Text fontSize="xs">
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
                          <Text fontSize="xs">
                            GSTIN: {val(consignee?.GSTIN)}
                          </Text>
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
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Sr.No
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Item Description
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Lr No.
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Challan No
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Lot No
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Boxes
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            QTY
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Unit Rate(Rs)
                          </Td>
                          <Td
                            borderBottom=" 1px"
                            borderColor="black"
                            textAlign="center"
                            p={2}
                          >
                            Amount(Rs)
                          </Td>
                        </Tr>

                        {/* Items */}
                        {items.length > 0 ? (
                          items.map((item, index) => (
                            <Tr key={index} verticalAlign="top">
                              <Td borderColor="black" p={2} textAlign="center">
                                {index + 1}
                              </Td>

                              <Td borderColor="black" p={2} textAlign="center">
                                {" "}
                                {/* Aligned left */}
                                <Text>{item.raw.Description || "-"}</Text>
                                {item.batches.length > 0 &&
                                  item.batches.map((b, i) => (
                                    <Text key={i}>Batch: {b.batch || "-"}</Text>
                                  ))}
                              </Td>
                              <Td
                                borderColor="black"
                                p={2}
                                textAlign="center"
                              ></Td>
                              <Td
                                borderColor="black"
                                p={2}
                                textAlign="center"
                              ></Td>
                              <Td
                                borderColor="black"
                                p={2}
                                textAlign="center"
                              ></Td>

                              <Td
                                borderColor="black"
                                p={2}
                                textAlign="center"
                              ></Td>

                              <Td borderColor="black" p={2} textAlign="center">
                                {item.qty || "-"} {item.baseUnit || ""}
                              </Td>

                              <Td borderColor="black" p={2} textAlign="center">
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
                            <Tr>
                              <Td borderColor="black"></Td>
                              <Td borderColor="black" textAlign="center">
                                <b> As per Challan Attached</b>
                              </Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black">Total :</Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td p={2} textAlign="center"></Td>
                            </Tr>
                            <Tr>
                              <Td borderColor="black"></Td>
                              <Td borderColor="black" p={2} textAlign="center">
                                <b> PO NO :</b>
                              </Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td p={2} textAlign="center"></Td>
                            </Tr>
                            {pricingElements[0]?.totalDiscount !== 0 && (
                              <Tr>
                                <Td borderColor="black"></Td>
                                <Td
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                ></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black">Discount :</Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalDiscount.toFixed(2)}
                                </Td>
                              </Tr>
                            )}
                            {pricingElements[0]?.totalFreight > 0 && (
                              <Tr>
                                <Td borderColor="black"></Td>
                                <Td
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                ></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black">Freight :</Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalFreight.toFixed(2)}
                                </Td>
                              </Tr>
                            )}
                            {pricingElements[0]?.totalPacking > 0 && (
                              <Tr>
                                <Td borderColor="black"></Td>
                                <Td
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                ></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black">Packing :</Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalPacking.toFixed(2)}
                                </Td>
                              </Tr>
                            )}
                            {pricingElements[0]?.totalInsurance > 0 && (
                              <Tr>
                                <Td borderColor="black"></Td>
                                <Td
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                ></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black">Insurance :</Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].totalInsurance.toFixed(2)}
                                </Td>
                              </Tr>
                            )}
                            {pricingElements[0]?.overalTaxableAmount > 0 && (
                              <Tr>
                                <Td borderColor="black"></Td>
                                <Td
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                ></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black">
                                  Total Taxable Value :
                                </Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].overalTaxableAmount.toFixed(
                                    2
                                  )}
                                </Td>
                              </Tr>
                            )}

                            {pricingElements[0]?.overallIgst > 0 ? (
                              <Tr>
                                <Td borderColor="black"></Td>
                                <Td
                                  borderColor="black"
                                  p={2}
                                  textAlign="right"
                                ></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black">IGST :</Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td textAlign={"center"} borderColor="black">
                                  {pricingElements[0].igst}%
                                </Td>{" "}
                                <Td p={2} textAlign="center">
                                  {pricingElements[0].overallIgst.toFixed(2)}
                                </Td>
                              </Tr>
                            ) : (
                              <>
                                {pricingElements[0]?.overallcgst > 0 && (
                                  <Tr>
                                    <Td borderColor="black"></Td>
                                    <Td
                                      borderColor="black"
                                      p={2}
                                      textAlign="right"
                                    ></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black">CGST :</Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black">
                                      {pricingElements[0].cgst}%
                                    </Td>{" "}
                                    <Td p={2} textAlign="center">
                                      {pricingElements[0].overallcgst.toFixed(
                                        2
                                      )}
                                    </Td>
                                  </Tr>
                                )}
                                {pricingElements[0]?.overalugst > 0 && (
                                  <Tr>
                                    <Td borderColor="black"></Td>
                                    <Td
                                      borderColor="black"
                                      p={2}
                                      textAlign="right"
                                    ></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black">UGST :</Td>{" "}
                                    <Td borderColor="black"> </Td>{" "}
                                    <Td borderColor="black">
                                      {pricingElements[0].ugst}%
                                    </Td>{" "}
                                    <Td p={2} textAlign="center">
                                      {pricingElements[0].overalugst.toFixed(2)}
                                    </Td>
                                  </Tr>
                                )}
                                {pricingElements[0]?.overallsgst > 0 && (
                                  <Tr>
                                    <Td borderColor="black"></Td>
                                    <Td
                                      borderColor="black"
                                      p={2}
                                      textAlign="right"
                                    ></Td>
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black">SGST :</Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black" textAlign="center">
                                      {pricingElements[0].sgst}%
                                    </Td>{" "}
                                    <Td p={2} textAlign="center">
                                      {pricingElements[0].overallsgst.toFixed(
                                        2
                                      )}
                                    </Td>
                                  </Tr>
                                )}
                                {pricingElements[0]?.overallGST > 0 && (
                                  <Tr>
                                    <Td borderColor="black"></Td>
                                    <Td
                                      borderColor="black"
                                      p={2}
                                      textAlign="right"
                                    ></Td>
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black">
                                      GST Sub Total (Charges) :
                                    </Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td borderColor="black"></Td>{" "}
                                    <Td p={2} textAlign="center">
                                      {pricingElements[0].overallGST.toFixed(2)}
                                    </Td>
                                  </Tr>
                                )}
                              </>
                            )}
                            <Tr>
                              <Td borderColor="black"></Td>
                              <Td
                                borderColor="black"
                                p={2}
                                textAlign="right"
                              ></Td>
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"> Total Value :</Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td borderColor="black"></Td>{" "}
                              <Td p={2} textAlign="center"></Td>
                            </Tr>

                            {pricingElements[0]?.totalRoundOff !== 0 && (
                              <Tr>
                                <Td borderColor="black"></Td>
                                <Td ></Td>
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black">Rounded off :</Td>{" "}
                                <Td borderColor="black"></Td>{" "}
                                <Td borderColor="black"></Td>{" "}
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
                                    borderColor="black"
                                    p={2}
                                    fontWeight="bold"
                                  ></Td>
                                  <Td
                                    borderColor="black"
                                    p={2}
                                    textAlign="center"
                                  >
                                    {" "}
                                  </Td>
                                  <Td borderColor="black"></Td>
                                  <Td borderColor="black"></Td>
                                  <Td borderColor="black"></Td>
                                  <Td borderColor="black">
                                    Total Value Of Goods (In Word):
                                  </Td>
                                  <Td borderColor="black"></Td>
                                  <Td borderColor="black"></Td>
                                  <Td
                                    borderColor="black"
                                    p={2}
                                    textAlign="center"
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
                            <Text as="span">
                              Total Taxes Payable (In Word) :{" "}
                            </Text>
                            {pricingElements[0]?.GstInWords || "—"}
                          </Td>
                        </Tr>
                        <Tr>
                          <Td p={2} borderColor="black">
                            <Text as="span">
                              Total Value of Goods in (Figures):{" "}
                            </Text>
                            {totals?.GrandTotalInWords
                              ? totals.GrandTotalInWords
                              : "N/A"}
                          </Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </Flex>

                  {/* Row 4: Footer Section */}
                  <Flex>
                    <Box fontSize="sm" w="100%">
                      {/* Row 2: Company PAN + Declaration + Bank Details */}
                      <Flex borderTop="1px">
                        {/* Left Cell: Blank */}
                        <Box flex="8" borderRight="1px">
                          <Box w="100%" borderBottom="1px" p={7}>
                            {/* Intentionally left blank */}
                          </Box>

                          {/* Middle Cell: Office Address */}
                          <Box p={2}>
                            <Text>
                              <b>REG. OFFICE :</b> UNIT NO. 1701, 17TH FLOOR,
                              SUPREME HEADQUARTERS, JUNCTION OF 14TH & 33RD
                              ROAD, BANDRA WEST, MUMBAI, 400050, MAHARASHTRA,
                              INDIA.
                            </Text>
                          </Box>
                        </Box>
                        {/* Right Cell: Authorization Small Width */}
                        <Box flex="2" fontWeight="bold" p={2} textAlign="right">
                          <Text>
                            For{" "}
                            {plants?.PlantName ||
                              selectedDoc?.seller?.name ||
                              "COMPANY"}
                          </Text>
                          <Box height="50px" />
                          <Text>AUTHORISED SIGNATORY</Text>
                        </Box>
                      </Flex>
                    </Box>
                  </Flex>
                </Box>

                {/* Document Footer */}
                <Flex>
                  <Box fontSize="sm" w="100%">
                    <Flex borderBottom=" 1px">
                      <Box flex="1" borderRight=" 1px" borderLeft=" 1px" p={2}>
                        <Text>
                          Terms : No complaint in respect of material supplied
                          vide this invoice will be entertained, unless the same
                          is lodged in writing within 8 Days after receipt of
                          Goods, our Responsibility regarding quality of yarn
                          ceases once the goods are converted. Interest @ 30%
                          p.a. will be charged if invoice is not paid by due
                          dates.
                        </Text>
                      </Box>
                    </Flex>
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
