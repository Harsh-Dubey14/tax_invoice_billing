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
  Th,
  Thead,
  Tfoot,
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
  const pricingElements = selectedDoc.PricingElements || [];

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
                    <Text fontWeight="bold">{plant.PlantName}</Text>
                    <Text>
                      {plant.StreetName
                        ? `${plant.StreetName}${
                            plant.HouseNumber ? ", " + plant.HouseNumber : ""
                          }, ${plant.CityName || ""}, ${plant.PostalCode || ""}`
                        : "Address not available"}
                    </Text>
                    <Text>GSTIN: {Tax.GST || "-"}</Text>
                    <Text>
                      State:{" "}
                      {plant.Region || "Dadra & Nagar Haveli and Daman & Diu"}
                    </Text>
                    <Text>Email: sales@meritpolymers.com</Text>
                  </Td>
                  <Td border="1px solid black" p={2}>
                    <Table size="sm" color="black">
                      <Tbody>
                        <Tr>
                          <Td border="1px solid black">
                            Invoice No:{" "}
                            <b>{selectedDoc.BillingDocument.BillingDocument}</b>
                          </Td>
                          <Td border="1px solid black">
                            Date:{" "}
                            <b>
                              {selectedDoc.BillingDocument.BillingDocumentDate}
                            </b>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td border="1px solid black">
                            Mode/Terms of Payment:{" "}
                            <b>
                              {selectedDoc.BillingDocument.PaymentTermsName ||
                                "-"}
                            </b>
                          </Td>
                          <Td border="1px solid black">
                            Destination:{" "}
                            <b>
                              {plant.CityName ||
                                selectedDoc.BillingDocument
                                  .destinationCountry ||
                                "-"}
                            </b>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td border="1px solid black">
                            Buyer Order No:{" "}
                            <b>{so.PurchaseOrderByCustomer || "-"}</b>
                          </Td>
                          <Td border="1px solid black">
                            Purchase Order Date:{" "}
                            <b>{so.CustomerPurchaseOrderDate || "-"}</b>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td border="1px solid black">
                            Delivery Note No:{" "}
                            <b>
                              {selectedDoc.DeliveryItems?.[0]
                                ?.DeliveryDocument || "-"}
                            </b>
                          </Td>
                          <Td border="1px solid black">
                            Delivery Note Date:{" "}
                            <b>
                              {selectedDoc.BillingDocument
                                .BillingDocumentDate || "-"}
                            </b>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td border="1px solid black">
                            Dispatched Through: <b>Bhavna Roadways</b>
                          </Td>
                          <Td border="1px solid black">
                            Motor Vehicle No:{" "}
                            <b>
                              {selectedDoc.BillingDocument.motorVehicleNo ||
                                "-"}
                            </b>
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
                      {consignee.StreetName || consignee.StreetPrefixName
                        ? `${
                            consignee.StreetName || consignee.StreetPrefixName
                          }${
                            consignee.HouseNumber
                              ? ", " + consignee.HouseNumber
                              : ""
                          }, ${consignee.CityName || ""}, ${
                            consignee.StateName || ""
                          } ${consignee.PostalCode || ""} ${
                            consignee.Region || ""
                          } ${consignee.Country || ""}`
                        : "-"}
                    </Text>
                    <Text>GSTIN: {consignee.GSTIN || "-"}</Text>
                  </Td>

                  {/* Buyer */}
                  <Td border="1px solid black" p={2}>
                    <Text fontWeight="bold">Buyer (Bill To):</Text>
                    <Text>{buyer.FullName || "-"}</Text>
                    <Text>
                      {buyer.StreetName || buyer.StreetPrefixName
                        ? `${buyer.StreetName || buyer.StreetPrefixName}${
                            buyer.HouseNumber ? ", " + buyer.HouseNumber : ""
                          }, ${buyer.CityName || ""}, ${
                            buyer.StateName || ""
                          } ${buyer.PostalCode || ""} ${buyer.Region || ""} ${
                            buyer.Country || ""
                          }`
                        : "-"}
                    </Text>
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
                  <Td border="1px solid black">Rate</Td>
                  <Td border="1px solid black">Amount</Td>
                </Tr>
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <Tr key={index}>
                      <Td border="1px solid black">{index + 1}</Td>
                      <Td border="1px solid black" p={2}>
                        <Text>{item.Description || "-"}</Text>
                        <Text>{item.Batch || "-"}</Text>
                      </Td>
                      <Td border="1px solid black">{HSN.HSN || "-"}</Td>
                      <Td border="1px solid black">
                        {item.quantity || "-"}
                        {item.unit || "-"}
                      </Td>
                      <Td border="1px solid black">{item.rate || "-"}</Td>
                      <Td border="1px solid black">{item.amount || "-"}</Td>
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

            {/* Pricing Elements Table */}
            <Table
              size="sm"
              variant="simple"
              border="1px solid black"
              w="100%"
              mb={2}
            >
              <Thead bg="gray.100" fontWeight="bold">
                <Tr>
                  <Th border="1px solid black" rowSpan={2}>
                    HSN/SAC
                  </Th>
                  <Th border="1px solid black" rowSpan={2}>
                    Taxable Value
                  </Th>
                  {pricingElements.some((pe) => pe.igst !== 0) && (
                    <Th border="1px solid black" colSpan={2} textAlign="center">
                      IGST
                    </Th>
                  )}
                  {pricingElements.some((pe) => pe.cgst !== 0) && (
                    <Th border="1px solid black" colSpan={2} textAlign="center">
                      CGST
                    </Th>
                  )}
                  {pricingElements.some((pe) => pe.sgst !== 0) && (
                    <Th border="1px solid black" colSpan={2} textAlign="center">
                      SGST
                    </Th>
                  )}
                  {pricingElements.some((pe) => pe.ugst !== 0) && (
                    <Th border="1px solid black" colSpan={2} textAlign="center">
                      UGST
                    </Th>
                  )}
                  <Th border="1px solid black" rowSpan={2}>
                    Total Tax Amount
                  </Th>
                </Tr>

                <Tr>
                  {pricingElements.some((pe) => pe.igst !== 0) && (
                    <>
                      <Th border="1px solid black">Rate</Th>
                      <Th border="1px solid black">Amount</Th>
                    </>
                  )}
                  {pricingElements.some((pe) => pe.cgst !== 0) && (
                    <>
                      <Th border="1px solid black">Rate</Th>
                      <Th border="1px solid black">Amount</Th>
                    </>
                  )}
                  {pricingElements.some((pe) => pe.sgst !== 0) && (
                    <>
                      <Th border="1px solid black">Rate</Th>
                      <Th border="1px solid black">Amount</Th>
                    </>
                  )}
                  {pricingElements.some((pe) => pe.ugst !== 0) && (
                    <>
                      <Th border="1px solid black">Rate</Th>
                      <Th border="1px solid black">Amount</Th>
                    </>
                  )}
                </Tr>
              </Thead>

              <Tbody>
                {pricingElements && pricingElements.length > 0 ? (
                  pricingElements.map((pe, index) => (
                    <Tr key={index}>
                      <Td border="1px solid black">{HSN.HSN ?? "-"}</Td>
                      <Td border="1px solid black">{pe.TotalAmount ?? "-"}</Td>

                      {pe.igst !== 0 && (
                        <>
                          <Td border="1px solid black">{pe.igst}</Td>
                          <Td border="1px solid black">{pe.igstRate}</Td>
                        </>
                      )}
                      {pe.cgst !== 0 && (
                        <>
                          <Td border="1px solid black">{pe.cgst}</Td>
                          <Td border="1px solid black">{pe.cgstRate}</Td>
                        </>
                      )}
                      {pe.sgst !== 0 && (
                        <>
                          <Td border="1px solid black">{pe.sgst}</Td>
                          <Td border="1px solid black">{pe.sgstRate}</Td>
                        </>
                      )}
                      {pe.ugst !== 0 && (
                        <>
                          <Td border="1px solid black">{pe.ugst}</Td>
                          <Td border="1px solid black">{pe.ugstRate}</Td>
                        </>
                      )}

                      <Td border="1px solid black">{pe.totalTax}</Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td border="1px solid black" colSpan={8} textAlign="center">
                      No line item data available.
                    </Td>
                  </Tr>
                )}
              </Tbody>

              <Tfoot fontWeight="bold">
                <Tr>
                  <Td border="1px solid black">TOTAL</Td>
                  <Td border="1px solid black">
                    {pricingElements.reduce(
                      (sum, el) => sum + (el.TotalAmount || 0),
                      0
                    )}
                  </Td>

                  {pricingElements.some((pe) => pe.igst !== 0) && (
                    <>
                      <Td border="1px solid black">—</Td>
                      <Td border="1px solid black">
                        {pricingElements.reduce(
                          (sum, el) => sum + (el.igstRate || 0),
                          0
                        )}
                      </Td>
                    </>
                  )}
                  {pricingElements.some((pe) => pe.cgst !== 0) && (
                    <>
                      <Td border="1px solid black">—</Td>
                      <Td border="1px solid black">
                        {pricingElements.reduce(
                          (sum, el) => sum + (el.cgstRate || 0),
                          0
                        )}
                      </Td>
                    </>
                  )}
                  {pricingElements.some((pe) => pe.sgst !== 0) && (
                    <>
                      <Td border="1px solid black">—</Td>
                      <Td border="1px solid black">
                        {pricingElements.reduce(
                          (sum, el) => sum + (el.sgstRate || 0),
                          0
                        )}
                      </Td>
                    </>
                  )}
                  {pricingElements.some((pe) => pe.ugst !== 0) && (
                    <>
                      <Td border="1px solid black">—</Td>
                      <Td border="1px solid black">
                        {pricingElements.reduce(
                          (sum, el) => sum + (el.ugstRate || 0),
                          0
                        )}
                      </Td>
                    </>
                  )}

                  <Td border="1px solid black">
                    {pricingElements.reduce(
                      (sum, el) => sum + (el.totalTax || 0),
                      0
                    )}
                  </Td>
                </Tr>
              </Tfoot>
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
