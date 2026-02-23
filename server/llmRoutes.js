import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from './db.js';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODEL_DIR = path.join(__dirname, '..', 'models');
const MODEL_FILENAME = 'mistral-7b-instruct-v0.2.Q4_K_M.gguf';
const MODEL_PATH = path.join(MODEL_DIR, MODEL_FILENAME);

const router = express.Router();

// Lazy load LLM resources
let llama = null;
let model = null;
let llmAvailable = null; // null = not checked, true/false = result

async function getLlamaInstance() {
    if (llmAvailable === false) return null;
    if (!fs.existsSync(MODEL_PATH)) {
        llmAvailable = false;
        return null;
    }
    try {
        if (!llama) {
            const llamaModule = await import('node-llama-cpp');
            llama = await llamaModule.getLlama();
        }
        if (!model) {
            model = await llama.loadModel({ modelPath: MODEL_PATH });
        }
        llmAvailable = true;
        return { llama, model };
    } catch (e) {
        console.error('LLM init failed:', e.message);
        llmAvailable = false;
        return null;
    }
}

// =============================================
// INTELLIGENT KEYWORD PARSER (Primary Engine)
// =============================================

// Hardware category aliases
const CATEGORY_MAP = {
    laptop: 'LAPTOP', laptops: 'LAPTOP',
    monitor: 'MONITOR', monitors: 'MONITOR', screen: 'MONITOR', screens: 'MONITOR', display: 'MONITOR',
    cpu: 'CPU', cpus: 'CPU', desktop: 'CPU', desktops: 'CPU', computer: 'CPU', computers: 'CPU',
    ups: 'UPS',
    printer: 'PRINTER', printers: 'PRINTER',
    'laser printer': 'LASER PRINTER', 'laser printers': 'LASER PRINTER',
    'inkjet printer': 'INKJET PRINTER', 'inkjet printers': 'INKJET PRINTER',
    scanner: 'SCANNER', scanners: 'SCANNER',
    projector: 'PROJECTOR', projectors: 'PROJECTOR'
};

// Collection detection keywords
const COLLECTION_KEYWORDS = {
    employees: ['employee', 'employees', 'staff', 'worker', 'workers', 'person', 'people', 'pin', 'retirement', 'retiring', 'post', 'wing', 'section'],
    hardware: ['hardware', 'laptop', 'laptops', 'monitor', 'monitors', 'cpu', 'cpus', 'ups', 'printer', 'printers', 'scanner', 'scanners', 'projector', 'projectors', 'desktop', 'desktops', 'computer', 'computers', 'equipment', 'device', 'devices', 'item', 'items', 'serial', 'allocated', 'allocation', 'working', 'defective', 'condemned', 'amc', 'warranty'],
    suppliers: ['supplier', 'suppliers', 'vendor', 'vendors', 'company', 'companies'],
    invoices: ['invoice', 'invoices', 'bill', 'bills', 'purchase', 'purchased', 'bought'],
    software: ['software', 'license', 'licenses', 'application', 'applications'],
    permanent_allocation: ['transferred', 'transfer', 'transfers', 'permanent allocation', 'perm allocation', 'permanently allocated']
};

// Status aliases
const STATUS_MAP = {
    working: 'Working',
    defective: 'Defective',
    condemned: 'Condemned',
    disposed: 'Disposed',
    good: 'Working',
    broken: 'Defective',
    damaged: 'Defective'
};

// Known hardware makes/brands
const KNOWN_MAKES = ['hp', 'dell', 'lenovo', 'acer', 'asus', 'samsung', 'lg', 'epson', 'canon', 'brother', 'apc', 'intex', 'wipro', 'hcl', 'compaq', 'toshiba', 'apple', 'benq', 'viewsonic', 'sony'];

function parseQuery(queryText) {
    const q = queryText.toLowerCase().trim();
    const words = q.split(/\s+/);
    const result = { collection: null, filter: {} };

    // 1. Detect collection
    let maxScore = 0;
    for (const [coll, keywords] of Object.entries(COLLECTION_KEYWORDS)) {
        let score = 0;
        for (const kw of keywords) {
            if (q.includes(kw)) score += kw.length; // longer keyword = stronger signal
        }
        if (score > maxScore) {
            maxScore = score;
            result.collection = coll;
        }
    }

    // Default to hardware if no collection detected
    if (!result.collection) result.collection = 'hardware';

    // 2. Extract filters based on detected collection
    if (result.collection === 'hardware') {
        // Detect category
        for (const [alias, category] of Object.entries(CATEGORY_MAP)) {
            if (q.includes(alias)) {
                result.filter.Category = category;
                break;
            }
        }

        // Detect make/brand
        for (const make of KNOWN_MAKES) {
            if (words.includes(make)) {
                result.filter.Make = make.toUpperCase();
                break;
            }
        }

        // Detect status
        for (const [alias, status] of Object.entries(STATUS_MAP)) {
            if (words.includes(alias)) {
                result.filter.Status = status;
                break;
            }
        }

        // Detect "allocated to" PIN
        const allocMatch = q.match(/allocated\s+to\s+(\d+)/i);
        if (allocMatch) {
            result.filter.Allocated_To = allocMatch[1];
        }

        // Detect serial number
        const serialMatch = q.match(/serial\s+(?:number\s+)?(\S+)/i);
        if (serialMatch) {
            result.filter.Company_Serial = serialMatch[1];
        }

        // Detect EDP serial
        const edpMatch = q.match(/edp\s+(?:serial\s+)?(\S+)/i);
        if (edpMatch) {
            result.filter.EDP_Serial = edpMatch[1];
        }

        // Detect bill number
        const billMatch = q.match(/bill\s+(?:number\s+|no\s+|#\s*)?(\d+)/i);
        if (billMatch) {
            result.filter.Bill_Number = billMatch[1];
        }
    }

    if (result.collection === 'employees') {
        // Detect office - flexible matching for formats like AUDIT-II, AMG-III, etc.
        const officeMatch = q.match(/(?:in|from|at|office)\s+([A-Za-z][A-Za-z0-9_\-]+(?:[\s-][A-Za-z0-9_\-]+)*)/i);
        if (officeMatch) {
            result.filter.Office = officeMatch[1].toUpperCase();
        }

        // Detect PIN
        const pinMatch = q.match(/pin\s+(?:number\s+)?(\d+)/i) || q.match(/\b(\d{7,})\b/);
        if (pinMatch) {
            result.filter.PIN = pinMatch[1];
        }

        // Detect name
        const nameMatch = q.match(/(?:name|named|employee)\s+([A-Z][A-Za-z\s]+)/i);
        if (nameMatch && nameMatch[1].trim().length > 2) {
            result.filter.Name = nameMatch[1].trim();
        }

        // Detect post
        const postMatch = q.match(/post\s+([A-Z][A-Za-z.\s]+)/i);
        if (postMatch) {
            result.filter.Present_Post = postMatch[1].trim();
        }

        // Detect section
        const sectionMatch = q.match(/section\s+([A-Z][A-Za-z0-9-\s]+)/i);
        if (sectionMatch) {
            result.filter.Section = sectionMatch[1].trim();
        }

        // Detect wing
        const wingMatch = q.match(/wing\s+([A-Z][A-Za-z0-9-]+)/i);
        if (wingMatch) {
            result.filter.Wing = wingMatch[1].toUpperCase();
        }

        // Detect retirement queries  
        if (q.includes('retir')) {
            // Check for year
            const yearMatch = q.match(/\b(20\d{2})\b/);
            if (yearMatch) {
                result.filter.Retirement_Date = yearMatch[1];
            }
        }
    }

    if (result.collection === 'suppliers') {
        // Detect city
        const cityMatch = q.match(/(?:in|from|at|city)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        if (cityMatch) {
            result.filter.City = cityMatch[1];
        }

        // Detect supplier name
        const supplierMatch = q.match(/(?:supplier|vendor|company)\s+(?:named?\s+)?([A-Z][A-Za-z\s]+)/i);
        if (supplierMatch && supplierMatch[1].trim().length > 2) {
            result.filter.Supplier_Name = supplierMatch[1].trim();
        }
    }

    if (result.collection === 'invoices') {
        // Detect bill number
        const billMatch = q.match(/(?:bill|invoice)\s+(?:number\s+|no\s+|#\s*)?(\d+)/i);
        if (billMatch) {
            result.filter.Bill_Number = billMatch[1];
        }

        // Detect supplier
        const suppMatch = q.match(/(?:from|supplier|vendor)\s+([A-Z][A-Za-z\s]+)/i);
        if (suppMatch && suppMatch[1].trim().length > 2) {
            result.filter.Supplier = suppMatch[1].trim();
        }
    }

    // 3. Detect dates in filter (apply to any collection)
    const dateMatch = q.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dateMatch) {
        const dateStr = `${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3]}`;
        if (result.collection === 'hardware') {
            if (q.includes('purchase') || q.includes('bought')) {
                result.filter.Date_of_Purchase = dateStr;
            } else if (q.includes('warranty')) {
                result.filter.Warranty_Upto = dateStr;
            } else if (q.includes('amc')) {
                result.filter.AMC_Upto = dateStr;
            } else if (q.includes('issued') || q.includes('allocated')) {
                result.filter.Issued_Date = dateStr;
            }
        }
    }

    // Year-only detection
    const yearOnlyMatch = q.match(/\b(20\d{2})\b/);
    if (yearOnlyMatch && Object.keys(result.filter).length === 0 && result.collection === 'hardware') {
        // If only a year is given, likely looking for items from that year
        result.filter._year = yearOnlyMatch[1]; // Special marker for year-based search
    }

    return result;
}

// Execute filter against the database
function executeFilter(collection, filter) {
    // Map collection name to actual DB key
    let targetData;
    if (collection === 'ewaste') {
        targetData = db.data.ewasteItems || db.data.ewaste || [];
    } else {
        targetData = db.data[collection] || [];
    }

    if (!Array.isArray(targetData)) return [];
    if (!filter || Object.keys(filter).length === 0) return targetData;

    // Handle special _year filter
    const yearFilter = filter._year;
    const normalFilters = { ...filter };
    delete normalFilters._year;

    return targetData.filter(item => {
        // Check year across all date fields
        if (yearFilter) {
            const dateFields = Object.keys(item).filter(k =>
                k.includes('Date') || k.includes('date') || k === 'DOB' ||
                k === 'AMC_Upto' || k === 'Warranty_Upto' || k === 'Issued_Date' || k === 'Retirement_Date'
            );
            const yearFound = dateFields.some(field =>
                String(item[field] || '').includes(yearFilter)
            );
            if (!yearFound) return false;
        }

        // Check normal filters
        return Object.entries(normalFilters).every(([key, value]) => {
            const itemVal = item[key];
            if (itemVal === undefined || itemVal === null) return false;

            const itemStr = String(itemVal).toLowerCase();
            const valStr = String(value).toLowerCase();

            return itemStr.includes(valStr);
        });
    });
}

// =============================================
// ROUTE HANDLER
// =============================================

router.post('/query', async (req, res) => {
    let context = null;
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log(`\n=== Chat Query: "${query}" ===`);

        // Force DB read
        await db.read();

        // Step 1: Use keyword parser (fast, reliable)
        const parsed = parseQuery(query);
        console.log(`Keyword Parser Result: collection="${parsed.collection}", filter=`, JSON.stringify(parsed.filter));

        // Step 2: Execute the filter
        const filteredData = executeFilter(parsed.collection, parsed.filter);
        console.log(`Matched ${filteredData.length} records from "${parsed.collection}".`);

        // Build interpretation response
        const interpretation = {
            collection: parsed.collection,
            filter: parsed.filter,
            method: 'keyword_parser'
        };

        if (filteredData.length === 0) {
            return res.json({
                success: true,
                matchedCount: 0,
                message: `No records found in "${parsed.collection}" matching your query. Try rephrasing or using different terms.`,
                llmInterpretation: interpretation
            });
        }

        // Generate Excel buffer
        const worksheet = xlsx.utils.json_to_sheet(filteredData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Query Results');
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const byteArray = Array.from(new Uint8Array(buffer));

        res.json({
            success: true,
            matchedCount: filteredData.length,
            excelBuffer: byteArray,
            llmInterpretation: interpretation
        });

    } catch (error) {
        console.error('Query Route Error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (context) {
            await context.dispose();
        }
    }
});

export default router;
