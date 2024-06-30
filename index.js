const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const companyModel = require("./models/companies");
const { companyDetailsValidation } = require("./validation/validation");
const {
  generateSalaryPDF,
  generateEPFPDF,
  generateETFPDF,
  generatePaySlipPDF,
} = require("./pdf_generation/GeneratePDF");
const { PDFDocument, degrees } = require("pdf-lib");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URL);

// Utility function to fetch details for PDF generation
const details_for_pdf = async (employer_no, period) => {
  try {
    const company = await companyModel.findOne({ employer_no });
    if (!company) {
      throw new Error("Company not found.");
    }

    const monthly_details = company.employees.map((employee) => {
      const monthlyDetail = employee.monthly_details.find(
        (detail) => detail.period === period
      );
      return { employee: employee, monthly_detail: monthlyDetail };
    });

    const payment_details = company.monthly_payments.find(
      (payment) => payment.period === period
    );

    if (!monthly_details || !payment_details) {
      throw new Error("Monthly or payment details not found.");
    }

    return { company, monthly_details, payment_details };
  } catch (error) {
    throw new Error(
      `Failed to fetch details for PDF generation: ${error.message}`
    );
  }
};

// Helper function to generate and combine payslip PDFs
async function generateCombinedPayslipPDF(
  company,
  monthly_details,
  payment_details,
  combineIntoOnePage = false
) {
  const payslipBuffers = [];

  // Get employee from monthly_details
  for (const entry of monthly_details) {
    const payslipPdfBytes = await generatePaySlipPDF(
      company,
      [entry], // Pass the relevant monthly_detail entry
      payment_details,
      entry.employee.epf_no
    );
    payslipBuffers.push(payslipPdfBytes);
  }

  // Combine all payslip PDFs into one
  const combinedPdfDoc = await PDFDocument.create();
  if (combineIntoOnePage) {
    const page = combinedPdfDoc.addPage();
    const { width, height } = page.getSize();

    for (let i = 0; i < payslipBuffers.length; i++) {
      const payslipPdfDoc = await PDFDocument.load(payslipBuffers[i]);
      const [embeddedPage] = await combinedPdfDoc.embedPages(
        payslipPdfDoc.getPages()
      );
      const xOffset = ((i % 2) * width) / 2;
      const yOffset = height - (Math.floor(i / 2) * height) / 2 - height / 2;

      page.drawPage(embeddedPage, {
        x: xOffset,
        y: yOffset,
        width: width / 2,
        height: height / 2,
      });
    }
  } else {
    for (const payslipBuffer of payslipBuffers) {
      const payslipPdfDoc = await PDFDocument.load(payslipBuffer);
      const copiedPages = await combinedPdfDoc.copyPages(
        payslipPdfDoc,
        payslipPdfDoc.getPageIndices()
      );
      copiedPages.forEach((page) => combinedPdfDoc.addPage(page));
    }
  }

  return await combinedPdfDoc.save();
}

// Function to generate all relevant PDFs and combine them
async function generateAllPDFs(
  company,
  monthly_details,
  payment_details,
  printable = false
) {
  const buffers = [];

  // Generate Salary PDF if required
  if (company.salary_sheets_required) {
    const salaryPdfBytes = await generateSalaryPDF(
      company,
      monthly_details,
      payment_details
    );
    //if printable rotate to potrait
    if (printable === true) {
      const salaryPdfDoc = await PDFDocument.load(salaryPdfBytes);
      const [page] = salaryPdfDoc.getPages();
      page.setRotation(degrees(90));
      const rotatedPdfBytes = await salaryPdfDoc.save();
      buffers.push(rotatedPdfBytes);
    } else {
      buffers.push(salaryPdfBytes);
    }
  }

  // Generate EPF PDF if required
  if (company.epf_required) {
    const epfPdfBytes = await generateEPFPDF(
      company,
      monthly_details,
      payment_details
    );
    buffers.push(epfPdfBytes);
    //if printable add two copies
    if (printable === true) {
      buffers.push(epfPdfBytes);
    }
  }

  // Generate ETF PDF if required
  if (company.etf_required) {
    const etfPdfBytes = await generateETFPDF(
      company,
      monthly_details,
      payment_details
    );
    buffers.push(etfPdfBytes);
    //if printable add two copies
    if (printable === true) {
      buffers.push(etfPdfBytes);
    }
  }

  // Generate Payslips PDF if required (printable format)
  if (company.pay_slips_required) {
    const payslipAllPrintablePdfBytes = await generateCombinedPayslipPDF(
      company,
      monthly_details,
      payment_details,
      true
    );
    buffers.push(payslipAllPrintablePdfBytes);
  }

  // Combine all generated PDFs into one document
  const combinedPdfDoc = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdfDoc = await PDFDocument.load(buffer);
    const copiedPages = await combinedPdfDoc.copyPages(
      pdfDoc,
      pdfDoc.getPageIndices()
    );
    copiedPages.forEach((page) => combinedPdfDoc.addPage(page));
  }

  return await combinedPdfDoc.save();
}

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
