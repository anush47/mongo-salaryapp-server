const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const companyModel = require("./models/companies");
const { companyDetailsValidation } = require("./validation/validation");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URL);

app.get("/get-companies", (req, res) => {
  const search = req.query.search;
  companyModel
    .find(
      { name: new RegExp(search || "", "i") },
      { name: 1, employer_no: 1, active: 1, employees: 1, _id: 0 } // Projection to include only specified fields
    )
    .then((companies) => {
      // Modify companies data
      companies = companies.map((company) => {
        let employeesCount = 0;
        let activeEmployeesCount = 0;
        if (company.employees && Array.isArray(company.employees)) {
          employeesCount = company.employees.length;
          activeEmployeesCount = company.employees.filter(
            (employee) => employee.active === true
          ).length;
        }
        return {
          ...company._doc,
          employeesCount: employeesCount,
          activeEmployeesCount: activeEmployeesCount,
        };
      });
      res.json(companies);
    })
    .catch((err) => res.json(err));
});

app.get("/get-employees", (req, res) => {
  const employer_no = req.query.employer_no;
  if (employer_no) {
    companyModel
      .findOne({ employer_no: employer_no })
      .then((company) => res.json(company.employees))
      .catch((err) => res.json(err));
  }
  //console.log(company);
});

app.get("/fields", (req, res) => {
  const schema = req.query.schema;
  switch (schema) {
    case "company":
      const company_Fields = Object.keys(companyModel.schema.paths);
      res.json(company_Fields);
      break;
    case "employee":
      const employee_Fields = Object.keys(
        companyModel.schema.paths.employees.schema.paths
      );
      res.json(employee_Fields);
      break;
    case "monthly-employee-details":
      const monthly_employee_fields = Object.keys(
        companyModel.schema.paths.employees.schema.paths.monthly_details.schema
          .paths
      );
      //console.log(monthly_employee_Fields);
      res.json(monthly_employee_fields);
      break;
    case "monthly-payments":
      const monthly_payment_fields = Object.keys(
        companyModel.schema.paths.monthly_payments.schema.paths
      );
      //console.log(monthly_payment_fields);
      res.json(monthly_payment_fields);
      break;
    default:
      break;
  }
});

app.get("/get-company", (req, res) => {
  const employer_no = req.query.employer_no;
  companyModel
    .findOne({ employer_no: employer_no })
    .then((company) => res.json(company))
    .catch((err) => res.json(err));
});

app.post("/update-company", async (req, res) => {
  try {
    const updateData = { ...req.body };
    const companyId = updateData._id;
    delete updateData._id;

    // Check if 'monthly_details' is present and has a valid structure
    if (
      updateData.employees &&
      Array.isArray(updateData.employees) &&
      updateData.employees.length > 0
    ) {
      updateData.employees.forEach((employee) => {
        if (!employee.monthly_details) {
          employee.monthly_details = []; // Set empty array if 'monthly_details' is missing
        }
      });
    }

    if (companyDetailsValidation(updateData)) {
      const updatedCompany = await companyModel.findByIdAndUpdate(
        companyId,
        { $set: updateData },
        { new: true }
      );

      res.json({
        message: "Company updated successfully",
        company: updatedCompany,
      });
    } else {
      res.status(400).json({ error: "Invalid data" });
    }
  } catch (error) {
    console.error("Error updating company:", error);

    if (
      error.code === 11000 &&
      error.keyPattern &&
      error.keyPattern.employer_no
    ) {
      // Duplicate key error (code 11000)
      res.status(400).json({ error: "Duplicate key error" });
    } else {
      // Other errors
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.post("/add-company", async (req, res) => {
  if (companyDetailsValidation(req.body)) {
    try {
      const newCompany = new companyModel(req.body);
      await newCompany.save();
      console.log(newCompany);

      res
        .status(201)
        .json({ message: "Company added successfully", company: newCompany });
    } catch (error) {
      console.error("Error adding company:", error);
      if (
        error.code === 11000 &&
        error.keyPattern &&
        error.keyPattern.employer_no
      ) {
        // Duplicate key error (code 11000) for the employer_no field
        res.status(400).json({ error: "Duplicate key error" });
      } else {
        // Other errors
        res.status(500).json({ error: "Internal server error" });
      }
    }
  } else {
    return res.status(400).send("Invalid data");
  }
});

app.post("/delete-company", async (req, res) => {
  const { employer_no } = req.body.params; // Assuming employer_no is sent in the request body
  console.log(employer_no);
  try {
    // Find the company by employer_no and delete it
    const deletedCompany = await companyModel.findOneAndDelete({ employer_no });

    if (!deletedCompany) {
      return res.status(404).json({ error: "Company not found." });
    }

    res.json({ message: "Company deleted successfully.", deletedCompany });
  } catch (error) {
    console.error("Error deleting company:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the company." });
  }
});

app.listen(3001, () => {
  console.log("Server is running on port 3001");
});
