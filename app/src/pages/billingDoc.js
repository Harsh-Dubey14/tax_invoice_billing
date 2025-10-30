import React, { useEffect, useState } from "react";
import axios from "axios";
import { useTheme } from "../theme/ThemeProviderWrapper";
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Spinner,
  Center,
  HStack,
  Button,
  Badge,
  Checkbox,
  IconButton,
  Input,
  useToast,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import {
  MoonIcon,
  SunIcon,
  ViewIcon,
  DownloadIcon,
  ChevronDownIcon,
} from "@chakra-ui/icons";

import InvoiceModal from "../component/taxInvoice";
import DNSFormat from "../component/DNSFormat";
import NewFormat from "../component/newFormat";
import Random from "../component/random"; // ✅ Fixed uppercase import

const API_BASE_URL = "http://localhost:4004/api/v1";
const ITEMS_PER_PAGE = 10;

const BillingDashboard = () => {
  const [billingDocuments, setBillingDocuments] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModal, setSelectedModal] = useState("Tax Invoice");
  const toast = useToast();

  const { colorMode, toggleColorMode } = useTheme();

  // ✅ Theme colors
  const bgColor = useColorModeValue("gray.50", "gray.800");
  const tableBg = useColorModeValue("white", "gray.700");
  const tableHeaderBg = useColorModeValue("blue.100", "blue.900");
  const hoverBg = useColorModeValue("gray.100", "gray.600");
  const headingColor = useColorModeValue("blue.700", "blue.200");
  const selectedRowBg = useColorModeValue("blue.50", "blue.900");

  // ✅ Fetch billing documents
  useEffect(() => {
    const fetchBillingDocuments = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/billingDocument`);
        setBillingDocuments(res.data.value || []);
        setFilteredDocs(res.data.value || []);
      } catch (error) {
        toast({
          title: "Error fetching documents",
          description: error.message,
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchBillingDocuments();
  }, [toast]);

  // ✅ Filter documents when search term changes
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredDocs(billingDocuments);
    } else {
      const filtered = billingDocuments.filter((doc) =>
        doc.BillingDocument.toString().includes(searchTerm.trim())
      );
      setFilteredDocs(filtered);
      setCurrentPage(1);
    }
  }, [searchTerm, billingDocuments]);

  const totalPages = Math.ceil(filteredDocs.length / ITEMS_PER_PAGE);
  const paginatedData = filteredDocs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const fetchDocumentDetails = async (billingDocumentId) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/billingDocument`, {
        BillingDocument: billingDocumentId,
      });
      return res.data;
    } catch (err) {
      toast({
        title: "Error fetching detailed document",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return null;
    }
  };

  const handlePreview = async () => {
    if (!selectedDoc) {
      toast({
        title: "Please select a document first",
        status: "warning",
        duration: 2500,
        isClosable: true,
      });
      return;
    }
    const detailedDoc = await fetchDocumentDetails(selectedDoc.BillingDocument);
    if (detailedDoc) {
      setSelectedDoc(detailedDoc);
      setIsModalOpen(true);
    }
  };

  return (
    <Box p={6} bg={bgColor} minH="100vh">
      {/* Header */}
      <HStack justify="space-between" mb={6}>
        <Heading fontSize="2xl" color={headingColor}>
          Billing Document List
        </Heading>
        <HStack spacing={3}>
          <IconButton
            icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            variant="outline"
            colorScheme="teal"
            aria-label="Toggle Theme"
          />
          <IconButton
            icon={<ViewIcon />}
            colorScheme="blue"
            variant="outline"
            onClick={handlePreview}
            isDisabled={!selectedDoc} // ✅ safer
          />
          <IconButton
            icon={<DownloadIcon />}
            colorScheme="green"
            variant="outline"
            onClick={handlePreview} // TODO: Replace with real download later
            isDisabled={!selectedDoc} // ✅ safer
          />
        </HStack>
      </HStack>

      {/* ✅ Search Input + Dropdown Button */}
      <HStack mb={4} justify="space-between">
        <Input
          placeholder="Search by BillingDocument"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          fontSize="sm"
          height="30px"
          width="30%"
        />

        {/* ✅ Dropdown Button for selecting component */}
        <Menu>
          <MenuButton
            as={Button}
            rightIcon={<ChevronDownIcon />}
            colorScheme="blue"
            size="sm"
          >
            {selectedModal}
          </MenuButton>
          <MenuList>
            <MenuItem onClick={() => setSelectedModal("Tax Invoice")}>
              Tax Invoice
            </MenuItem>
            <MenuItem onClick={() => setSelectedModal("DNS Format")}>
              DNS Format
            </MenuItem>
            <MenuItem onClick={() => setSelectedModal("New Format")}>
              New Format
            </MenuItem>
            <MenuItem onClick={() => setSelectedModal("Random")}>
              Random
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>

      {/* ✅ Show selected Billing Document */}
        <HStack mb={4}>
          <Badge colorScheme="blue" fontSize="md">
            Selected Billing Document:{" "}
            {String(
              selectedDoc?.BillingDocument?.billingDocumentID ||
                selectedDoc?.BillingDocument ||
                selectedDoc?.billingDocumentID ||
                "N/A"
            )}
          </Badge>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={async () => {
              if (!selectedDoc) {
                toast({
                  title: "Please select a document first",
                  status: "warning",
                  duration: 2500,
                  isClosable: true,
                });
                return;
              }
              const detailedDoc = await fetchDocumentDetails(
                selectedDoc.BillingDocument
              );
              if (detailedDoc) {
                setSelectedDoc(detailedDoc);
                setIsModalOpen(true);
              }
            }}
          >
            Preview
          </Button>
        </HStack>

      {/* Table */}
      <Box p={4} bg={tableBg} borderRadius="md" boxShadow="lg" overflowX="auto">
        {loading ? (
          <Center h="200px">
            <Spinner size="xl" color="blue.500" />
          </Center>
        ) : (
          <>
            <Table size="md" variant="simple">
              <Thead bg={tableHeaderBg}>
                <Tr>
                  <Th>Select</Th>
                  <Th>BillingDocument</Th>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>CompanyCode</Th>
                  <Th>FiscalYear</Th>
                  <Th>SalesOrg</Th>
                  <Th>Division</Th>
                </Tr>
              </Thead>

              <Tbody>
                {paginatedData.map((doc) => {
                  const isSelected =
                    selectedDoc?.BillingDocument === doc.BillingDocument;
                  return (
                    <Tr
                      key={doc.BillingDocument}
                      _hover={{ bg: hoverBg, cursor: "pointer" }}
                      bg={isSelected ? selectedRowBg : "transparent"}
                      onClick={() => setSelectedDoc(isSelected ? null : doc)}
                      onDoubleClick={async () => {
                        setSelectedDoc(doc);
                        const detailedDoc = await fetchDocumentDetails(
                          doc.BillingDocument
                        );
                        if (detailedDoc) {
                          setSelectedDoc(detailedDoc);
                          setIsModalOpen(true);
                        }
                      }}
                      tabIndex={0}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && isSelected) {
                          const detailedDoc = await fetchDocumentDetails(
                            doc.BillingDocument
                          );
                          if (detailedDoc) {
                            setSelectedDoc(detailedDoc);
                            setIsModalOpen(true);
                          }
                        }
                      }}
                    >
                      <Td onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          isChecked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedDoc(isSelected ? null : doc);
                          }}
                        />
                      </Td>
                      <Td>{doc.BillingDocument}</Td>
                      <Td>{doc.BillingDocumentDate}</Td>
                      <Td>{doc.BillingDocumentType}</Td>
                      <Td>{doc.CompanyCode}</Td>
                      <Td>{doc.FiscalYear}</Td>
                      <Td>{doc.salesOrganization}</Td>
                      <Td>{doc.Division}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>

            {/* Pagination */}
            <HStack spacing={4} mt={4} justify="center">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Box fontWeight="semibold">
                Page {currentPage} of {totalPages}
              </Box>
              <Button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </HStack>
          </>
        )}
      </Box>

      {/* ✅ Conditional Modals */}
      {selectedModal === "Tax Invoice" && (
        <InvoiceModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDoc(null);
          }}
          selectedDoc={selectedDoc}
        />
      )}

      {selectedModal === "DNS Format" && (
        <DNSFormat
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDoc(null);
          }}
          selectedDoc={selectedDoc}
        />
      )}

      {selectedModal === "New Format" && (
        <NewFormat
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDoc(null);
          }}
          selectedDoc={selectedDoc}
        />
      )}

      {selectedModal === "Random" && (
        <Random
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDoc(null);
          }}
          selectedDoc={selectedDoc}
        />
      )}
    </Box>
  );
};

export default BillingDashboard;
