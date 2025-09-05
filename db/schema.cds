namespace my.employees;

entity Employees {
    key Empid     : String(8);
    key Headid    : UUID;
    Name          : String(50);
    Email         : String(50);
    Phone         : String(15);
    Department    : String(30);
    Doj           : DateTime;
}
