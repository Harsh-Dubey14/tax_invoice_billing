using my.employees as db from '../db/schema';

service sap_build_cap_sample_library @(path: '/api/v1') {

    entity Employees as projection on db.Employees;

}
