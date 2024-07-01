const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const bcrypt = require("bcryptjs"); // For password hashing
const jwt = require("jsonwebtoken"); // For generating JWT tokens
const companyModel = require("./models/companies");
const User = require("./models/users");
const authenticate = require("./middleware/authenticate");
const { companyDetailsValidation } = require("./validation/validation");
const {
  generateSalaryPDF,
  generateEPFPDF,
  generateETFPDF,
  generatePaySlipPDF,
  generateCombinedPayslipPDF,
  generateAllPDFs,
  details_for_pdf,
} = require("./pdf_generation/GeneratePDF");

const { abhFill } = require("./pdf_generation/abhFill");
const { PDFDocument } = require("pdf-lib");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URL);

//post abhfill
app.post("/generate-abh", async (req, res) => {
  try {
    const abh = req.body;
    const pdfBytes = await abhFill(abh.data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=abh-filled.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (e) {
    console.log(e);
    //respond
    res.status(500).send("Error getting the form : " + e);
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Please provide email and password." });
  }

  try {
    // Check if user exists in your database
    const user = await User.findOne({ email });
    console.log(user);
    if (!user) {
      return res.status(400).json({ error: "Invalid email." });
    }

    // Check if password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials." });
    }

    // Generate and return JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Route to fetch user profile details
app.get("/user/profile", authenticate, async (req, res) => {
  try {
    res.send(req.user); // Send user details stored in req.user
  } catch (error) {
    res.status(500).send({ error: "Internal server error." });
  }
});

// Signup endpoint
app.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;

  // Basic validation
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Please provide email and password." });
  }

  try {
    // Check if user with the same email already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: "User already exists." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    user = new User({ email, password: hashedPassword, name, type: "basic" });
    await user.save();

    // After loading dotenv, access JWT_SECRET from process.env
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is missing in environment variables.");
      process.exit(1); // Exit process if JWT_SECRET is not defined
    }

    // Generate and return JWT token
    const token = jwt.sign({ id: user._id }, jwtSecret);
    res.json({ token });
  } catch (error) {
    console.error("Error signing up:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Endpoint for generating various PDFs (updated with "all" case)
app.get("/generate-pdf", async (req, res) => {
  const { employer_no, period, type, epf_no } = req.query;
  console.log(employer_no, period, type, epf_no);

  try {
    if (!employer_no || !period || !type) {
      return res.status(400).json({ error: "Missing required parameters." });
    }

    const { company, monthly_details, payment_details } = await details_for_pdf(
      employer_no,
      period
    );

    let pdfBytes, filename;

    switch (type) {
      case "salary":
        pdfBytes = await generateSalaryPDF(
          company,
          monthly_details,
          payment_details
        );
        filename = `${company.name} - ${period} - salary.pdf`;
        break;
      case "epf":
        pdfBytes = await generateEPFPDF(
          company,
          monthly_details,
          payment_details
        );
        filename = `${company.name} - ${period} - epf.pdf`;
        break;
      case "etf":
        pdfBytes = await generateETFPDF(
          company,
          monthly_details,
          payment_details
        );
        filename = `${company.name} - ${period} - etf.pdf`;
        break;
      case "payslip":
        if (!epf_no) {
          return res
            .status(400)
            .json({ error: "EPF number is required for payslip." });
        }
        pdfBytes = await generatePaySlipPDF(
          company,
          monthly_details,
          payment_details,
          parseInt(epf_no)
        );
        filename = `${company.name} - ${period} - (${epf_no}) payslip.pdf`;
        break;
      case "payslip_all":
        pdfBytes = await generateCombinedPayslipPDF(
          company,
          monthly_details,
          payment_details,
          false
        );
        filename = `${company.name} - ${period} - all_payslips.pdf`;
        break;
      case "payslip_all_printable":
        pdfBytes = await generateCombinedPayslipPDF(
          company,
          monthly_details,
          payment_details,
          true
        );
        filename = `${company.name} - ${period} - all_payslips_printable.pdf`;
        break;
      case "all":
        pdfBytes = await generateAllPDFs(
          company,
          monthly_details,
          payment_details
        );
        filename = `${company.name} - ${period} - all_combined.pdf`;
        break;
      case "all_printable":
        pdfBytes = await generateAllPDFs(
          company,
          monthly_details,
          payment_details,
          true
        );
        filename = `${company.name} - ${period} - all_combined_printable.pdf`;
        break;
      default:
        return res.status(400).json({ error: "Invalid PDF type specified." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF." });
  }
});

app.get("/generate-pdf-all", async (req, res) => {
  let { period, printable } = req.query;
  //to bool
  printable = printable === "true";
  console.log(`Generating PDFs for period: ${period} ${printable}`);

  try {
    // Get all active companies
    const companies = await companyModel.find({ active: true });

    // Generate PDF for each company
    const pdfBuffers = [];
    for (const company of companies) {
      const { monthly_details, payment_details } = await details_for_pdf(
        company.employer_no,
        period
      );
      const pdfBytes = await generateAllPDFs(
        company,
        monthly_details,
        payment_details,
        printable
      );
      pdfBuffers.push(pdfBytes);
    }

    // Combine all generated PDFs into one document
    const combinedPdfDoc = await PDFDocument.create();
    for (const buffer of pdfBuffers) {
      const pdfDoc = await PDFDocument.load(buffer);
      const copiedPages = await combinedPdfDoc.copyPages(
        pdfDoc,
        pdfDoc.getPageIndices()
      );
      copiedPages.forEach((page) => combinedPdfDoc.addPage(page));
    }

    // Prepare the combined PDF for download
    const pdfBytes = await combinedPdfDoc.save();
    const filename = `all_companies-${period}.pdf`;

    // Set headers and send the PDF as a response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes)); // Ensure buffer is correctly sent
  } catch (error) {
    console.error("Error generating PDFs:", error);
    res.status(500).send("Error generating PDFs");
  }
});

const get_ref_no = async (employer_no, period) => {
  const url = "https://www.cbsl.lk/EPFCRef/";

  try {
    // Extracting employer number parts
    const [zn, em] = employer_no.split("/");
    const mn = period.replace("-", "");

    // Launching Puppeteer browser
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the target URL
    await page.goto(url);

    // Filling form inputs
    await page.type("#zn", zn.toUpperCase());
    await page.type("#em", em);

    // Checking if mn is a valid option in the select list
    const mnOptionExists = await page.evaluate((mn) => {
      const mnSelect = document.querySelector("#mn");
      return Array.from(mnSelect.options).some((option) => option.value === mn);
    }, mn);

    await page.select("#mn", mn);
    await page.click("#checkb");

    // Waiting for the results
    await page.waitForSelector("#empnm");

    // Extracting data
    const empNameElement = await page.$("#empnm");
    let empName = await page.evaluate(
      (el) => el.innerText.split(":")[1].trim(),
      empNameElement
    );

    const refNoElement = await page.$("#refno");
    let refNo = "";

    if (mnOptionExists) {
      refNo = await page.evaluate(
        (el) => el.innerText.split(":")[1].trim(),
        refNoElement
      );
    }

    // Closing browser
    await browser.close();

    return [refNo, empName];
  } catch (error) {
    console.error("An error occurred:", error);
    return [null, null];
  }
};

app.get("/get-companies", (req, res) => {
  const search = req.query.search;
  companyModel
    .find(
      { name: new RegExp(search || "", "i") }
      //{ _id: 0 } // Projection to include only specified fields
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
          employees_count: employeesCount,
          active_employees_count: activeEmployeesCount,
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

app.get("/get-reference-no", async (req, res) => {
  const employer_no = req.query.employer_no;
  const period = req.query.period;
  let [referenceNo, name] = await get_ref_no(employer_no, period);
  console.log(name, employer_no, period, referenceNo);
  res.json(referenceNo);
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
      console.log(newCompany);
      await newCompany.save();

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
