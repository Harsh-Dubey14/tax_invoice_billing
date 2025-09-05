const axios = require('axios');

module.exports = srv => {
    const ODATA_URL = "https://my414535-api.s4hana.cloud.sap/sap/opu/odata/sap/ZUI_GETEMPLOYEE/ZC_GetEmployee";
    const ODATA_USER = "abhishek1494";
    const ODATA_PASS = "FyfGjZXxZwtPu(uVR5XBqobbgDLVsahveXMQlmAe";

    srv.on('READ', 'Employees', async () => {
        try {
            const authHeader = 'Basic ' + Buffer.from(`${ODATA_USER}:${ODATA_PASS}`).toString('base64');

            const response = await axios.get(`${ODATA_URL}?$format=json`, {
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json'
                }
            });
            return response.data.d.results.map(item => ({
                Empid: item.Empid,
                Headid: item.Headid,
                Name: item.Name,
                Email: item.Email,
                Phone: item.Phone,
                Department: item.Department,
                Doj: item.Doj
            }));

        } catch (err) {
            console.error("OData Error:", err.response ? err.response.data : err);
            return [];
        }
    });
};
