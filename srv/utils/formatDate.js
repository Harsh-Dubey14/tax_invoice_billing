// utils/formatDate.js

/**
 * Converts SAP OData date formats to YYYY-MM-DD
 * Supports:
 *   - YYYYMMDD (e.g., 20241015)
 *   - /Date(1697366400000)/ (OData JSON date)
 *   - Fallback: returns original string if unknown
 * @param {string|number} sapDate
 * @returns {string|null} formatted date
 */
const formatSAPDate = (sapDate) => {
    if (!sapDate) return null;

    // Case 1: YYYYMMDD
    if (/^\d{8}$/.test(sapDate)) {
        return `${sapDate.slice(0, 4)}-${sapDate.slice(4, 6)}-${sapDate.slice(6, 8)}`;
    }

    // Case 2: /Date(1697366400000)/ format
    const match = sapDate.toString().match(/\/Date\((\d+)\)\//);
    if (match) {
        return new Date(Number(match[1])).toISOString().split('T')[0];
    }

    // Fallback: return original
    return sapDate;
};

module.exports = formatSAPDate;
