"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedOCRService = exports.EnhancedOCRService = void 0;
const tesseract_js_1 = require("tesseract.js");
const sharp_1 = __importDefault(require("sharp"));
const index_1 = require("../index");
const CircuitBreakerService_1 = require("./CircuitBreakerService");
class EnhancedOCRService {
    constructor() {
        this.workerPool = [];
        this.poolSize = 3;
        this.initializeWorkerPool();
    }
    async initializeWorkerPool() {
        try {
            for (let i = 0; i < this.poolSize; i++) {
                const worker = await (0, tesseract_js_1.createWorker)('eng', 1, {
                    logger: m => index_1.logger.debug('Tesseract:', m)
                });
                // Configure for better receipt/bank statement recognition
                await worker.setParameters({
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,/-: ',
                    tessedit_pageseg_mode: 6, // Uniform block of text
                    tessedit_ocr_engine_mode: 2 // Tesseract + LSTM engine
                });
                this.workerPool.push(worker);
            }
            index_1.logger.info('OCR worker pool initialized', { poolSize: this.poolSize });
        }
        catch (error) {
            index_1.logger.error('Failed to initialize OCR worker pool', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async processPaymentProof(buffer, mimeType) {
        const startTime = Date.now();
        try {
            return await CircuitBreakerService_1.ocrServiceBreaker.execute(async () => {
                const processedBuffer = await this.preprocessImage(buffer, mimeType);
                const worker = await this.getAvailableWorker();
                try {
                    const { data } = await worker.recognize(processedBuffer);
                    const extractedData = await this.extractPaymentData(data.text);
                    const regions = this.processOCRRegions(data.words || []);
                    const result = {
                        text: data.text,
                        confidence: data.confidence,
                        extractedData,
                        regions,
                        processingTime: Date.now() - startTime
                    };
                    index_1.logger.info('OCR processing completed', {
                        confidence: data.confidence,
                        textLength: data.text.length,
                        processingTime: result.processingTime
                    });
                    return result;
                }
                finally {
                    this.releaseWorker(worker);
                }
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            index_1.logger.error('OCR processing failed', { error: errorMessage, processingTime: Date.now() - startTime });
            throw new Error(`OCR processing failed: ${errorMessage}`);
        }
    }
    async preprocessImage(buffer, mimeType) {
        if (!mimeType.startsWith('image/')) {
            throw new Error('Unsupported file type for OCR');
        }
        try {
            let pipeline = (0, sharp_1.default)(buffer);
            // Get image metadata
            const metadata = await pipeline.metadata();
            // Resize if too large (max 2000px on longest side)
            if (metadata.width && metadata.height) {
                const maxDimension = Math.max(metadata.width, metadata.height);
                if (maxDimension > 2000) {
                    const scale = 2000 / maxDimension;
                    pipeline = pipeline.resize(Math.round(metadata.width * scale), Math.round(metadata.height * scale), { withoutEnlargement: true });
                }
            }
            // Enhance image for better OCR
            pipeline = pipeline
                .greyscale() // Convert to grayscale
                .normalise() // Normalize contrast
                .sharpen({ sigma: 1, m1: 1, m2: 2 }) // Sharpen text
                .gamma(1.2) // Adjust gamma for better contrast
                .linear(1.5, -0.5); // Increase contrast
            // Apply additional filters for receipts/bank statements
            pipeline = pipeline.median(1); // Reduce noise
            return await pipeline.png().toBuffer();
        }
        catch (error) {
            index_1.logger.warn('Image preprocessing failed, using original', { error: error instanceof Error ? error.message : String(error) });
            return buffer; // Fallback to original buffer
        }
    }
    async extractPaymentData(text) {
        const normalizedText = text.toLowerCase();
        // Enhanced regex patterns with better context awareness
        const patterns = {
            amount: [
                // Standard formats: $123.45, 123.45 USD, USD 123.45
                /(?:amount|total|sum|paid|debit|charge)[\s:$]*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
                /(?:\$|usd|eur|gbp)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
                // Receipt formats: Total: 123.45
                /(?:total|subtotal|balance)[\s:]*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi
            ],
            reference: [
                // Transaction IDs, reference numbers
                /(?:ref|reference|txn|transaction|id)[\s#:]*([A-Z0-9]{6,})/gi,
                /(?:confirmation|confirm)[\s#:]*([A-Z0-9]{8,})/gi,
                // Bank reference formats
                /(?:sort code|account|acc)[\s#:]*([0-9\s-]{6,})/gi
            ],
            date: [
                // Various date formats
                /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g,
                /(\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})/g,
                // Written dates: Jan 15, 2024
                /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}/gi
            ],
            bank: [
                // Common bank names
                /(?:bank|banking|financial)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
                /(?:chase|bank of america|wells fargo|citi|capital one|pnc|td bank|suntrust)/gi
            ]
        };
        const extracted = {
            primaryAmount: null,
            allAmounts: [],
            primaryReference: null,
            allReferences: [],
            transactionDate: null,
            bankName: null,
            confidence: 0
        };
        // Extract amounts with validation
        for (const pattern of patterns.amount) {
            const matches = normalizedText.matchAll(pattern);
            for (const match of matches) {
                const amountStr = match[1].replace(/,/g, '');
                const amount = parseFloat(amountStr);
                if (amount > 0 && amount < 1000000 && !extracted.allAmounts.includes(amount)) {
                    extracted.allAmounts.push(amount);
                }
            }
        }
        // Sort amounts and pick the most reasonable one as primary
        extracted.allAmounts.sort((a, b) => b - a); // Descending order
        extracted.primaryAmount = extracted.allAmounts.length > 0 ? extracted.allAmounts[0] : null;
        // Extract references
        for (const pattern of patterns.reference) {
            const matches = text.matchAll(pattern); // Use original case for references
            for (const match of matches) {
                const ref = match[1].trim();
                if (ref.length >= 6 && !extracted.allReferences.includes(ref)) {
                    extracted.allReferences.push(ref);
                }
            }
        }
        extracted.primaryReference = extracted.allReferences[0] || null;
        // Extract dates
        const dates = [];
        for (const pattern of patterns.date) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                dates.push(match[1]);
            }
        }
        extracted.transactionDate = dates[0] || null;
        // Extract bank names
        const banks = [];
        for (const pattern of patterns.bank) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                banks.push(match[1].trim());
            }
        }
        extracted.bankName = banks[0] || null;
        // Calculate confidence score
        extracted.confidence = this.calculateConfidence(extracted);
        return extracted;
    }
    calculateConfidence(data) {
        let score = 0;
        // Amount confidence (40% weight)
        if (data.primaryAmount && data.allAmounts.length > 0) {
            score += 0.4;
            // Bonus for multiple amounts (suggests better extraction)
            if (data.allAmounts.length > 1)
                score += 0.1;
        }
        // Reference confidence (30% weight)
        if (data.primaryReference && data.allReferences.length > 0) {
            score += 0.3;
            // Bonus for longer references (more specific)
            if (data.primaryReference.length > 10)
                score += 0.1;
        }
        // Date confidence (15% weight)
        if (data.transactionDate) {
            score += 0.15;
        }
        // Bank confidence (15% weight)
        if (data.bankName) {
            score += 0.15;
        }
        return Math.min(score, 1.0); // Cap at 100%
    }
    processOCRRegions(words) {
        return words
            .filter(word => word.confidence > 30) // Filter low confidence words
            .map(word => ({
            text: word.text,
            confidence: word.confidence,
            bbox: {
                x0: word.bbox.x0,
                y0: word.bbox.y0,
                x1: word.bbox.x1,
                y1: word.bbox.y1
            }
        }))
            .sort((a, b) => b.confidence - a.confidence); // Sort by confidence
    }
    async getAvailableWorker() {
        // Simple round-robin worker selection
        // In production, consider a more sophisticated pool manager
        if (this.workerPool.length === 0) {
            throw new Error('No OCR workers available');
        }
        // For now, just return the first worker
        // TODO: Implement proper worker pool management
        return this.workerPool[0];
    }
    releaseWorker(worker) {
        // Worker is released back to pool
        // In current implementation, workers are always available
    }
    async cleanup() {
        for (const worker of this.workerPool) {
            await worker.terminate();
        }
        this.workerPool = [];
        index_1.logger.info('OCR worker pool cleaned up');
    }
    // Health check
    async healthCheck() {
        try {
            if (this.workerPool.length === 0)
                return false;
            const worker = this.workerPool[0];
            await worker.getPDF(''); // Simple operation to test worker
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.EnhancedOCRService = EnhancedOCRService;
// Global OCR service instance
exports.enhancedOCRService = new EnhancedOCRService();
//# sourceMappingURL=EnhancedOCRService.js.map