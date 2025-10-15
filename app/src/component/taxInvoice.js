import React, { useRef } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Box,
  Text,
  Table,
  Tbody,
  Tr,
  Td,
  Image,
  HStack,
  IconButton,
} from "@chakra-ui/react";
import { DownloadIcon } from "@chakra-ui/icons";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const InvoiceModal = ({ isOpen, onClose, selectedDoc }) => {
  const invoiceRef = useRef(null);

  if (!selectedDoc) return null;

  const plant = selectedDoc.Plants?.[0] || {};
  const buyer = selectedDoc.Buyer?.[0] || {};
  const consignee = selectedDoc.Consignee?.[0] || {};
  const items = selectedDoc.Items || [];
  const so = selectedDoc.SalesOrders?.[0] || {};
  const HSN = selectedDoc.HSN?.[0] || {};
  const Tax = selectedDoc.Tax?.[0] || {};

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Invoice_${selectedDoc.BillingDocument.BillingDocument}.pdf`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent p={6} bg="white" color="black">
        <ModalHeader>Invoice Preview</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <HStack mb={4} justify="flex-end">
            <IconButton
              icon={<DownloadIcon />}
              colorScheme="green"
              variant="outline"
              onClick={handleDownload}
            />
          </HStack>

          <Box
            ref={invoiceRef}
            bg="white"
            color="black"
            p={4}
            border="1px solid black"
            fontSize="sm"
          >
            {/* Header */}
            <Table
              w="100%"
              mb={4}
              variant="simple"
              size="sm"
              border="1px solid black"
              color="black"
            >
              <Tbody>
                <Tr>
                  <Td border="1px solid black" w="50%" p={2}>
                    <Image
                      src="/merit_logo.png"
                      alt="Merit Logo"
                      boxSize="80px"
                      mb={2}
                    />
                    <Text fontWeight="bold">
                      {plant.PlantName || "MERIT POLYMERS PRIVATE LIMITED"}
                    </Text>
                    <Text>
                      {plant.StreetName
                        ? `${plant.StreetName}${
                            plant.HouseNumber ? ", " + plant.HouseNumber : ""
                          }, ${plant.CityName || ""}, ${plant.PostalCode || ""}`
                        : "Address not available"}
                    </Text>
                    <Text>GSTIN: {Tax.GST || "-"}</Text>
                    <Text>
                      State: {plant.Region || "Dadra & Nagar Haveli and Daman & Diu"}
                    </Text>
                    <Text>Email: sales@meritpolymers.com</Text>
                  </Td>
                  <Td border="1px solid black" p={2}>
                    <Table size="sm" color="black">
                      <Tbody>
                        <Tr>
                          <Td border="1px solid black">
                            Invoice No: <b>{selectedDoc.BillingDocument.BillingDocument}</b>
                          </Td>
                          <Td border="1px solid black">
                            Date: <b>{selectedDoc.BillingDocument.BillingDocumentDate}</b>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td border="1px solid black">
                            Mode/Terms of Payment:{" "}
                            <b>{selectedDoc.BillingDocument.PaymentTermsName || "-"}</b>
                          </Td>
                          <Td border="1px solid black">
                            Destination:{" "}
                            <b>{plant.CityName || selectedDoc.BillingDocument.destinationCountry || "-"}</b>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td border="1px solid black">
                            Buyer Order No: <b>{so.PurchaseOrderByCustomer || "-"}</b>
                          </Td>
                          <Td border="1px solid black">
                            Purchase Order Date: <b>{so.CustomerPurchaseOrderDate || "-"}</b>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td border="1px solid black">
                            Delivery Note No:{" "}
                            <b>{selectedDoc.DeliveryItems?.[0]?.DeliveryDocument || "-"}</b>
                          </Td>
                          <Td border="1px solid black">
                            Delivery Note Date:{" "}
                            <b>{selectedDoc.BillingDocument.BillingDocumentDate || "-"}</b>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td border="1px solid black">
                            Dispatched Through: <b>Bhavna Roadways</b>
                          </Td>
                          <Td border="1px solid black">
                            Motor Vehicle No:{" "}
                            <b>{selectedDoc.BillingDocument.motorVehicleNo || "-"}</b>
                          </Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </Td>
                </Tr>
              </Tbody>
            </Table>

            {/* Consignee / Buyer */}
          <Table w="100%" mb={2} size="sm" variant="simple" color="black">
  <Tbody>
    <Tr>
      {/* Consignee */}
      <Td border="1px solid black" p={2}>
        <Text fontWeight="bold">Consignee (Ship To):</Text>
        <Text>{consignee.FullName || "-"}</Text>
        <Text>
          {consignee.StreetName
            ? `${consignee.StreetName}${consignee.HouseNumber ? ", " + consignee.HouseNumber : ""}, ${consignee.CityName || ""}, ${consignee.CompanyPostalCode || ""}, ${consignee.Country || ""}`
            : " "}
        </Text>
        <Text>{consignee.StreetPrefixName}{consignee.AdditionalStreetPrefixName}</Text>
        <Text>GSTIN: {consignee.GSTIN || "-"}</Text>
      </Td>

      {/* Buyer */}
      <Td border="1px solid black" p={2}>
        <Text fontWeight="bold">Buyer (Bill To):</Text>
        <Text>{buyer.FullName || "-"}</Text>
        <Text>
          {buyer.StreetName
            ? `${buyer.StreetName}${buyer.HouseNumber ? ", " + buyer.HouseNumber : ""}, ${buyer.CityName || ""}, ${buyer.CompanyPostalCode || ""}, ${buyer.Country || ""}`
            : " "}
        </Text>
        <Text> {buyer.StreetPrefixName}{buyer.AdditionalStreetPrefixName}</Text>
        <Text>GSTIN: {buyer.GSTIN || "-"}</Text>
      </Td>
    </Tr>
  </Tbody>
</Table>

            {/* Items */}
            <Table
              size="sm"
              variant="simple"
              border="1px solid black"
              w="100%"
              mb={2}
              color="black"
            >
              <Tbody>
                <Tr bg="gray.100" fontWeight="bold">
                  <Td border="1px solid black">Sr. No</Td>
                  <Td border="1px solid black">Material Description</Td>
                  <Td border="1px solid black">HSN</Td>
                  <Td border="1px solid black">Quantity</Td>
                  <Td border="1px solid black">Amount</Td>
                  <Td border="1px solid black">Rate</Td>
                </Tr>
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <Tr key={index}>
                      <Td border="1px solid black">{index + 1}</Td>
                      <Td border="1px solid black">{item.Description || "-"}</Td>
                      <Td border="1px solid black">{HSN.HSN || "-"}</Td>
                      <Td border="1px solid black">{item.quantity || "-"}</Td>
                      <Td border="1px solid black">{item.amount || "-"}</Td>
                      <Td border="1px solid black">{item.rate || "-"}</Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={6} border="1px solid black" textAlign="center">
                      No item details available.
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>

            <Text mt={4} textAlign="center" fontWeight="bold">
              *** End of Invoice ***
            </Text>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default InvoiceModal;
