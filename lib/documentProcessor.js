// Enhanced Document Processing Service with better summary generation
import dotenv from 'dotenv';
dotenv.config();
import { documentAI, languageClient, translateClient, vertexAI, PROCESSORS, MODELS, getAvailableModel } from './googleCloud.js';
// import ClauseDictionary from './clauseDictionary.js';

export class DocumentProcessor {
  constructor() {
    // this.clauseDict = new ClauseDictionary();
    this.apiTimeout = 60000; // Increased from 15000
    this.maxRetries = 2;     // Increased from 1
    this.apiCallCount = 0;   // Track API usage
  }




  // Helper function to wrap AI calls with timeout and retry logic
  async withTimeout(promise, timeoutMs = this.apiTimeout, retries = this.maxRetries, operation = 'API call') {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`${operation} - Attempt ${attempt + 1}/${retries + 1}`);

        const result = await Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms (attempt ${attempt + 1})`)), timeoutMs)
          )
        ]);

        console.log(`${operation} - Success on attempt ${attempt + 1}`);
        return result;

      } catch (error) {
        if (attempt === retries) {
          console.error(`${operation} - Failed after ${retries + 1} attempts:`, error.message);
          throw error;
        }

        const backoffDelay = Math.min(5000, 1000 * Math.pow(2, attempt));
        console.warn(`${operation} - Attempt ${attempt + 1} failed, retrying in ${backoffDelay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }


  // Detect document type from content
  detectDocumentType(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('lease') || lowerText.includes('rental') || lowerText.includes('tenant') || lowerText.includes('landlord')) {
      return 'lease';
    } else if (lowerText.includes('loan') || lowerText.includes('credit') || lowerText.includes('mortgage')) {
      return 'loan';
    } else if (lowerText.includes('employment') || lowerText.includes('job') || lowerText.includes('employee')) {
      return 'employment';
    } else if (lowerText.includes('service') || lowerText.includes('contractor') || lowerText.includes('consulting')) {
      return 'service';
    } else if (lowerText.includes('purchase') || lowerText.includes('sale') || lowerText.includes('buy') || lowerText.includes('sell')) {
      return 'purchase';
    } else if (lowerText.includes('partnership') || lowerText.includes('joint venture')) {
      return 'partnership';
    } else if (lowerText.includes('license') || lowerText.includes('licensing')) {
      return 'license';
    } else if (lowerText.includes('confidentiality') || lowerText.includes('non-disclosure') || lowerText.includes('nda')) {
      return 'nda';
    }

    return 'general';
  }

  async extractText(fileBuffer, fileType) {
    if (!documentAI || !process.env.FORM_PARSER_PROCESSOR_NAME) {
      throw new Error('Document AI not configured');
    }

    const processorName = process.env.FORM_PARSER_PROCESSOR_NAME;

    const mimeTypeMap = {
      'application/pdf': 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    const mappedMimeType = mimeTypeMap[fileType];
    if (!mappedMimeType) {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    const request = {
      name: processorName,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType: mappedMimeType,
      }
    };

    try {
      console.log('Extracting text with Document AI...');
      const [result] = await this.withTimeout(
        documentAI.processDocument(request),
        45000,
        1,
        'Document AI extraction'
      );

      if (result?.document?.text) {
        console.log('Document AI extraction successful, text length:', result.document.text.length);
        return result.document.text;
      }

      throw new Error('Document AI returned no text');
    } catch (error) {
      console.error('Document AI error:', error.message);
      throw error;
    }
  }

  async detectLanguage(text) {
    if (!translateClient) {
      console.warn('Translation API not configured, defaulting to English');
      return {
        language: 'en',
        confidence: 0.5
      };
    }

    try {
      console.log('Detecting language with Google Translation API...');

      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      const parent = `projects/${projectId}/locations/${location}`;

      // Use Translation API v3's detectLanguage method
      const request = {
        parent: parent,
        content: text.substring(0, 1000),
        mimeType: 'text/plain',
      };

      const [response] = await this.withTimeout(
        translateClient.detectLanguage(request),
        10000,
        2,
        'Language detection'
      );

      if (response && response.languages && response.languages.length > 0) {
        // The API returns languages sorted by confidence
        const detectedLanguage = response.languages[0].languageCode;
        const confidence = response.languages[0].confidence || 0.9;

        console.log(`Language detected: ${detectedLanguage} (confidence: ${confidence})`);

        return {
          language: detectedLanguage,
          confidence: confidence
        };
      }

      // Fallback to English
      return {
        language: 'en',
        confidence: 0.5
      };
    } catch (error) {
      console.error('Language detection failed:', error.message);
      return {
        language: 'en',
        confidence: 0.5
      };
    }
  }

  async generateSummary(text, detectedLanguage = 'en') {
    if (!vertexAI || !process.env.GOOGLE_CLOUD_PROJECT_ID) {
      console.warn('Vertex AI not configured, using detailed structured fallback');
      throw new Error('Vertex AI not configured');
    }

    try {
      const model = vertexAI.getGenerativeModel({
        model: await getAvailableModel(),
      });

      const documentType = this.detectDocumentType(text);



      // CRITICAL: Language instruction must be FIRST and EMPHATIC
      const languageInstruction = detectedLanguage !== 'en'
        ? `YOU MUST RESPOND ENTIRELY IN ${this.getLanguageName(detectedLanguage).toUpperCase()}. All headings, content, and explanations must be in ${this.getLanguageName(detectedLanguage)}.`
        : `RESPOND IN ENGLISH.`;

      const prompt = `${languageInstruction}

Analyze this legal document and create a structured summary using EXACTLY this markdown format:

Main Facts:
- **Document Type:** [type]
- **Monthly Rent/Payment:** [amount if applicable]
- **Security Deposit:** [amount if applicable]
- **Start Date:** [date]
- **End Date:** [date]
- **Notice Period:** [period]

## Parties Involved
**Landlord/Lender:** [name and key responsibilities]
**Tenant/Borrower:** [name and key responsibilities]

## Financial Obligations
- **Rent/Payment:** [details on when and how payment is due]
- **Late Fees:** [specific late fee details]
- **Other Charges:** [any other fees]

## Rights and Obligations
**Landlord's/Lender's Key Obligations:**
- [Responsibility 1]
- [Responsibility 2]

**Tenant's/Borrower's Key Obligations:**
- [Responsibility 1]
- [Responsibility 2]

## Termination and Renewal
- **Termination:** [How to terminate, notice periods]
- **Renewal:** [What happens at end of term]

## Risks and Penalties
- [Specific penalty or risk 1]
- [Specific penalty or risk 2]

CRITICAL RULES:
1. Use EXACTLY these section headers with ## 
2. ALL text must be in ${this.getLanguageName(detectedLanguage)}
3. Be specific with amounts and dates from the document
4. Keep each section concise (2-5 bullet points)
5. Use markdown formatting (**bold** for emphasis)

Document Text (first 4000 chars):
${text.substring(0, 4000)}
`;

      console.log(`Generating structured summary in ${detectedLanguage}...`);
      const result = await this.withTimeout(
        model.generateContent(prompt),
        30000,
        1,
        'Summary generation'
      );

      const generatedSummary = result.response.candidates[0].content.parts[0].text;

      // VALIDATION: Check if summary has required structure
      const hasStructure = generatedSummary.includes('## Key Details') ||
        generatedSummary.includes('## Parties') ||
        generatedSummary.includes('##');

      if (!hasStructure) {
        console.warn('AI did not return structured format, using fallback');
        throw new Error('AI did not return structured format');
      }

      console.log('Structured summary generated successfully');
      return generatedSummary;

    } catch (error) {
      console.error('Summary generation failed:', error.message);
      console.log('Using detailed structured fallback');
      throw error;
    }
  }




  // Enhanced document classification
  async classifyDocument(text, detectedLanguage = 'en') {
    try {
      const clauses = this.splitIntoClauses(text);
      const clausesToProcess = clauses.slice(0, 10);

      console.log(`Processing ${clausesToProcess.length} clauses in ${detectedLanguage}...`);

      const classifiedClauses = await Promise.all(
        clausesToProcess.map(async (clause, index) => {
          try {
            console.log(`Processing clause ${index + 1}/${clausesToProcess.length}`);

            // Run classification and risk assessment in parallel
            const [classification, riskAssessment] = await Promise.all([
              this.classifyClause(clause),
              this.assessRisk(clause),
            ]);

            console.log(`Classification: ${classification.type} (confidence: ${classification.confidence})`);
            console.log(`Risk: ${riskAssessment.score}/5 (${riskAssessment.category})`);

            const explanation = "";
            const suggestedQuestions = this.getFallbackQuestionsForType(classification.type);

            return {
              text: clause.substring(0, 500) + (clause.length > 500 ? '...' : ''),
              type: classification.type,
              confidence: classification.confidence,
              riskScore: riskAssessment.score,
              riskCategory: riskAssessment.category,
              explanation,
              suggestedQuestions,
            };
          } catch (clauseError) {
            console.error(`Error processing clause ${index + 1}:`, clauseError);
            return {
              text: clause.substring(0, 200) + "...",
              type: 'general',
              confidence: 0.3,
              riskScore: 2,
              riskCategory: 'medium',
              explanation: 'This clause requires manual review due to processing limitations.',
              suggestedQuestions: ['What does this clause mean?', 'How does this affect me?'],
            };
          }
        })
      );

      console.log(`Classification complete - processed ${classifiedClauses.length} clauses`);
      return classifiedClauses.length > 0 ? classifiedClauses : this.getFallbackClauses(text);

    } catch (error) {
      console.error('Error classifying document:', error);
      return this.getFallbackClauses(text);
    }
  }



  cleanAIResponse(text) {
    if (!text) return '';

    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[-•]\s/g, '')
      .replace(/\d+\.\s/g, '')
      .replace(/\n\s*\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 300);
  }

  getLanguageName(code) {
    const names = {
      'en': 'English',
      'hi': 'Hindi',
      'bn': 'Bengali',
      'te': 'Telugu',
      'mr': 'Marathi',
      'ta': 'Tamil',
      'ur': 'Urdu',
      'gu': 'Gujarati',
      'kn': 'Kannada',
      'ml': 'Malayalam',
      'pa': 'Punjabi',
      'or': 'Odia',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'ru': 'Russian'
    };
    return names[code] || 'English';
  }

  getFallbackQuestions() {
    return [
      "What are the main costs and fees mentioned?",
      "How can this agreement be terminated?",
      "What penalties apply if I don't follow the terms?",
      "What are my key rights and obligations?"
    ];
  }


  getFallbackQuestionsForType(type) {
    const questionsByType = {
      'termination': [
        'How do I properly end this agreement?',
        'What notice period is required to terminate?'
      ],
      'payment': [
        'When exactly are payments due?',
        'What happens if I miss a payment?'
      ],
      'penalty': [
        'What specific actions trigger penalties?',
        'How much will I owe if I violate this?'
      ],
      'renewal': [
        'Does this automatically renew?',
        'How do I prevent automatic renewal?'
      ],
      'liability': [
        'What am I financially responsible for?',
        'Are there limits on my liability?'
      ],
      'confidentiality': [
        'What information must I keep private?',
        'How long does confidentiality last?'
      ],
      'warranty': [
        'What exactly is guaranteed?',
        'What happens if the warranty is broken?'
      ],
      'collateral': [
        'What exactly am I pledging as collateral?',
        'Can the lender take my collateral if I default?'
      ],
      'interest': [
        'What is the exact interest rate?',
        'How is interest calculated and when is it due?'
      ],
      'default': [
        'What counts as being in default?',
        'What are the immediate consequences of default?'
      ],
      'repayment': [
        'What is the exact payment schedule?',
        'Can I pay off the loan early without penalty?'
      ],
      'general': [
        'What are the most important terms I should understand?',
        'What obligations do I have under this agreement?'
      ]
    };

    return questionsByType[type] || questionsByType['general'];
  }
  resetApiCallCounter() {
    this.apiCallCount = 0;
  }


  getFallbackClauses(text) {
    return [{
      text: text.substring(0, 500) + "...",
      type: 'general',
      confidence: 0.5,
      riskScore: 2,
      riskCategory: 'medium',
      explanation: 'This document contains legal terms that should be reviewed carefully with attention to obligations, deadlines, and potential penalties.',
      fromDictionary: false,
      suggestedQuestions: [
        'What are the main obligations in this document?',
        'Are there any important deadlines or penalties?'
      ],
    }];
  }

  splitIntoClauses(text) {
    try {
      console.log('Starting clause splitting, text length:', text.length);

      // First, try to split by common legal section markers
      const sectionMarkers = [
        /\n\s*\d+\.\s+/g,           // Numbered sections: "1. ", "2. "
        /\n\s*[A-Z]\.\s+/g,         // Lettered sections: "A. ", "B. "
        /\n\s*\([a-z]\)\s+/g,       // Parenthetical: "(a) ", "(b) "
        /\n\s*Article\s+\d+/gi,     // "Article 1", "Article 2"
        /\n\s*Section\s+\d+/gi,     // "Section 1", "Section 2"
        /\n\s*Clause\s+\d+/gi       // "Clause 1", "Clause 2"
      ];

      let clauses = [];

      // Try each section marker pattern
      for (const marker of sectionMarkers) {
        const sections = text.split(marker);
        if (sections.length > 3) {
          console.log(`Found ${sections.length} sections using marker pattern`);
          clauses = sections
            .filter(s => s.trim().length > 50)
            .slice(0, 15)
            .map(s => s.trim());
          break;
        }
      }

      // If section markers didn't work, use sentence-based splitting
      if (clauses.length < 5) {
        console.log('Using sentence-based splitting');

        // Split by sentence endings but be smarter about it
        const sentences = text
          .replace(/\n+/g, ' ')  // Replace newlines with spaces
          .split(/(?<=[.!?])\s+(?=[A-Z])/)  // Split on sentence boundaries
          .filter(sentence => sentence.trim().length > 30);

        console.log(`Found ${sentences.length} sentences`);

        clauses = [];

        // Strategy 1: Take individual sentences if they're substantial
        for (let i = 0; i < sentences.length && clauses.length < 15; i++) {
          const sentence = sentences[i].trim();
          if (sentence.length > 80) {
            clauses.push(sentence);
          }
        }

        // Strategy 2: If we don't have enough, group 2-3 sentences together
        if (clauses.length < 8) {
          clauses = [];
          for (let i = 0; i < sentences.length && clauses.length < 12; i += 2) {
            const clause = sentences.slice(i, i + 2).join(' ').trim();
            if (clause.length > 50) {
              clauses.push(clause);
            }
          }
        }
      }

      // If still not enough, try paragraph-based splitting
      if (clauses.length < 5) {
        console.log('Using paragraph-based splitting');
        const paragraphs = text
          .split(/\n\s*\n/)
          .filter(p => p.trim().length > 50)
          .map(p => p.trim());

        if (paragraphs.length > clauses.length) {
          clauses = paragraphs.slice(0, 12);
        }
      }

      // Last resort: chunk by character count
      if (clauses.length < 3) {
        console.log('Using character-based chunking as last resort');
        const chunkSize = 400;
        clauses = [];
        for (let i = 0; i < text.length && clauses.length < 10; i += chunkSize) {
          const chunk = text.substring(i, i + chunkSize).trim();
          if (chunk.length > 100) {
            clauses.push(chunk);
          }
        }
      }

      // Clean up clauses
      clauses = clauses
        .map(c => c.replace(/\s+/g, ' ').trim())  // Normalize whitespace
        .filter(c => c.length >= 40 && c.length <= 1000)  // Filter by length
        .slice(0, 10);

      console.log(`Final clause count: ${clauses.length}`);

      // Log first few clause lengths for debugging
      clauses.slice(0, 3).forEach((clause, i) => {
        console.log(`Clause ${i + 1} length: ${clause.length} chars`);
      });

      return clauses.length > 0 ? clauses : [text.substring(0, 500)];

    } catch (error) {
      console.error('Error splitting clauses:', error);
      return [text.substring(0, 500)];
    }
  }

  identifyClauseContext(clause, allClauses, index) {
    const lowerClause = clause.toLowerCase();

    // Add contextual scoring based on position and surrounding clauses
    const position = index / allClauses.length;

    // Early clauses often contain parties and general terms
    if (position < 0.3) {
      if (lowerClause.includes('party') || lowerClause.includes('parties')) {
        return { contextBoost: 'parties', weight: 1.5 };
      }
      if (lowerClause.includes('agreement') || lowerClause.includes('contract')) {
        return { contextBoost: 'general', weight: 1.3 };
      }
    }

    // Middle clauses often contain obligations and terms
    if (position >= 0.3 && position <= 0.7) {
      if (lowerClause.includes('shall') || lowerClause.includes('must')) {
        return { contextBoost: 'obligation', weight: 1.4 };
      }
      if (lowerClause.includes('payment') || lowerClause.includes('fee')) {
        return { contextBoost: 'financial', weight: 1.5 };
      }
    }

    // Later clauses often contain termination, penalties, and legal stuff
    if (position > 0.7) {
      if (lowerClause.includes('terminate') || lowerClause.includes('end')) {
        return { contextBoost: 'termination', weight: 1.5 };
      }
      if (lowerClause.includes('dispute') || lowerClause.includes('jurisdiction')) {
        return { contextBoost: 'legal', weight: 1.3 };
      }
    }

    return { contextBoost: 'none', weight: 1.0 };
  }
  // ADD this method right after the identifyClauseContext method in documentProcessor.js
  // Place it around line 1090 (after identifyClauseContext, before classifyClause)

  ensureClauseDiversity(classifiedClauses) {
    // Make sure we have a good mix of clause types
    const typeCount = {};

    classifiedClauses.forEach(clause => {
      typeCount[clause.type] = (typeCount[clause.type] || 0) + 1;
    });

    console.log('Clause type distribution:', typeCount);

    // If too many of one type, log a warning
    const maxSameType = 4;
    const typesOverLimit = Object.entries(typeCount)
      .filter(([type, count]) => count > maxSameType)
      .map(([type, count]) => ({ type, count }));

    if (typesOverLimit.length > 0) {
      console.log('Warning: High concentration of certain clause types:');
      typesOverLimit.forEach(({ type, count }) => {
        console.log(`  - ${type}: ${count} clauses`);
      });
    }

    // Calculate diversity score (0-1, higher is better)
    const uniqueTypes = Object.keys(typeCount).length;
    const totalClauses = classifiedClauses.length;
    const diversityScore = uniqueTypes / Math.min(totalClauses, 8); // Max 8 expected types

    console.log(`Diversity score: ${diversityScore.toFixed(2)} (${uniqueTypes} unique types out of ${totalClauses} clauses)`);

    return classifiedClauses;
  }

  async classifyClause(clause) {
    try {
      const clauseTypes = {
        'termination': ['terminate', 'end', 'cancel', 'expire', 'dissolution', 'conclude', 'cessation'],
        'payment': ['pay', 'fee', 'cost', 'amount', 'money', 'charge', 'bill', 'due', 'owe', 'rent', 'price', 'installment'],
        'penalty': ['penalty', 'fine', 'violation', 'breach', 'forfeit', 'damages', 'liquidated', 'default'],
        'renewal': ['renew', 'extend', 'automatic', 'continue', 'successive', 'perpetual'],
        'liability': ['liable', 'responsible', 'damages', 'injury', 'loss', 'indemnify', 'hold harmless'],
        'confidentiality': ['confidential', 'private', 'secret', 'disclosure', 'proprietary', 'non-disclosure'],
        'warranty': ['warrant', 'guarantee', 'assure', 'promise', 'represent', 'covenant'],
        'insurance': ['insurance', 'insure', 'coverage', 'policy', 'premium'],
        'maintenance': ['maintain', 'repair', 'upkeep', 'service', 'condition'],
        'use': ['use', 'utilize', 'occupy', 'operate', 'employ', 'purpose'],
        'notice': ['notice', 'notify', 'inform', 'advise', 'communication'],
        'assignment': ['assign', 'transfer', 'sublease', 'sublet', 'delegate'],
        // NEW LOAN-SPECIFIC TYPES
        'collateral': ['collateral', 'security', 'pledge', 'secure', 'shares', 'stock', 'asset', 'guarantee', 'pledged'],
        'interest': ['interest', 'rate', 'annual', 'APR', 'percentage', 'accrue', 'compound', 'calculated'],
        'default': ['default', 'failure', 'acceleration', 'demand', 'call', 'due immediately'],
        'repayment': ['repay', 'repayment', 'principal', 'balance', 'outstanding', 'amortization']
      };

      let bestType = 'general';
      let maxScore = 0;
      const lowerClause = clause.toLowerCase();

      for (const [type, keywords] of Object.entries(clauseTypes)) {
        let score = 0;
        for (const keyword of keywords) {
          if (lowerClause.includes(keyword)) {
            // Give more weight to longer, more specific keywords
            score += keyword.length > 6 ? 3 : (keyword.length > 4 ? 2 : 1);
          }
        }
        if (score > maxScore) {
          maxScore = score;
          bestType = type;
        }
      }

      return {
        type: bestType,
        confidence: maxScore > 0 ? Math.min(0.95, 0.5 + (maxScore * 0.08)) : 0.4
      };
    } catch (error) {
      console.error('Error classifying clause:', error);
      return { type: 'general', confidence: 0.3 };
    }
  }

  async assessRisk(clause) {
    try {
      const riskKeywords = {
        high: [
          'penalty', 'forfeit', 'liability', 'damages', 'terminate immediately',
          'breach', 'violation', 'liquidated damages', 'indemnify', 'default',
          'eviction', 'foreclosure', 'legal action', 'lawsuit'
        ],
        medium: [
          'fee', 'charge', 'notice', 'obligation', 'must', 'required',
          'shall', 'responsible', 'due', 'late', 'interest', 'repair',
          'maintain', 'insurance', 'deposit'
        ],
        low: [
          'option', 'may', 'discretion', 'suggest', 'recommend',
          'voluntary', 'preferred', 'encouraged'
        ]
      };

      let riskScore = 1;
      let riskCategory = 'low';
      const lowerClause = clause.toLowerCase();

      // Check for high risk keywords first
      let highMatches = 0;
      for (const keyword of riskKeywords.high) {
        if (lowerClause.includes(keyword)) {
          highMatches += keyword.length > 8 ? 3 : 2;
        }
      }

      if (highMatches > 0) {
        riskScore = Math.min(5, 3 + Math.floor(highMatches / 2));
        riskCategory = 'high';
      } else {
        // Check medium risk
        let mediumMatches = 0;
        for (const keyword of riskKeywords.medium) {
          if (lowerClause.includes(keyword)) {
            mediumMatches += keyword.length > 6 ? 2 : 1;
          }
        }

        if (mediumMatches > 2) {
          riskScore = Math.min(4, 2 + Math.floor(mediumMatches / 3));
          riskCategory = 'medium';
        } else if (mediumMatches > 0) {
          riskScore = 2;
          riskCategory = 'medium';
        } else {
          // Check for low risk indicators
          let lowMatches = 0;
          for (const keyword of riskKeywords.low) {
            if (lowerClause.includes(keyword)) {
              lowMatches++;
            }
          }
          riskScore = lowMatches > 0 ? 1 : 2;
          riskCategory = 'low';
        }
      }

      return { score: riskScore, category: riskCategory };
    } catch (error) {
      console.error('Error assessing risk:', error);
      return { score: 2, category: 'medium' };
    }
  }

  // Corrected code with safety settings
  async generateSmartQuestions(text, clauses, detectedLanguage = 'en') {
    try {
      if (!vertexAI) {
        console.warn('Vertex AI not available, using fallback questions');
        return this.getFallbackQuestions();
      }

      const MAX_TIMEOUT_MS = 25000;

      // Define safety settings (already present, keeping for stability)
      const safetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ];

      const model = vertexAI.getGenerativeModel({
        model: await getAvailableModel(),
        safetySettings,
      });

      const languageName = this.getLanguageName(detectedLanguage);

      // 1. ⬇️ CRITICAL FIX: Simplify Schema to Array of Strings
      const responseSchema = {
        type: "object",
        properties: {
          questions: {
            type: "array",
            description: `A list of exactly 4 specific, actionable questions in ${languageName}.`,
            items: {
              type: "string", // Simple string array
              description: "A question focusing on obligations, costs, penalties, or deadlines."
            }
          }
        },
        required: ["questions"]
      };

      const languageInstruction = detectedLanguage !== 'en'
        ? `CRITICAL: Generate ALL questions in ${languageName.toUpperCase()}. Do not use English.`
        : `Generate questions in English.`;

      const documentExcerpt = text.substring(0, 4000);

      // 2. ⬇️ CRITICAL FIX: Remove all "id" and formatting rules that confuse the model
      const prompt = `${languageInstruction}

You are analyzing a legal document. Your goal is to help a non-expert user understand their risks and obligations.

Generate exactly 4 specific, practical questions that a person should ask about this document.

RULES:
1. Focus on specific monetary amounts, penalties, deadlines, or major maintenance duties.
2. Ensure all questions are relevant to the document content provided below.
3. The answer MUST be a single JSON object containing a property called "questions" which is an array of 4 strings.
4. DO NOT include any unnecessary fields like "id" or numbers in the JSON array items.

Document Context:
---
${documentExcerpt}
---
`;

      console.log('Generating structured smart questions...');

      const result = await this.withTimeout(
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2
          }
        }),
        MAX_TIMEOUT_MS,
        1,
        'Smart questions generation'
      );

      const responseText = result.response.candidates[0].content.parts[0].text;

      // 3. Robust Parsing Logic
      try {
        let jsonString = responseText.trim();

        // Strip markdown code fences (```json ... ```)
        if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        }

        // Attempt to repair truncated/incomplete JSON
        if (!jsonString.endsWith('}')) {
          // Remove trailing comma if present, then force close array and object
          jsonString = jsonString.replace(/,\s*$/, '');
          if (jsonString.endsWith('"')) {
            // Ends mid-string, try to close the string and object/array
            jsonString += '"]}'
          } else if (!jsonString.endsWith(']')) {
            // Ends after an item, but array isn't closed
            jsonString += ']}'
          } else if (!jsonString.endsWith('}')) {
            jsonString += '}'; // Close the object
          }
        }

        const jsonResponse = JSON.parse(jsonString);

        // Extract the simple array of strings
        const questions = jsonResponse.questions
          .slice(0, 4)
          .filter(q => typeof q === 'string' && q.includes('?') && q.length > 15);

        console.log(`✅ Extracted ${questions.length} questions from structured AI response.`);

        // 4. Fallback if structured output was incomplete
        if (questions.length < 4) {
          const fallbacks = this.getFallbackQuestions();
          while (questions.length < 4 && fallbacks.length > 0) {
            const fallback = fallbacks.shift();
            if (!questions.includes(fallback)) {
              questions.push(fallback);
            }
          }
        }

        return questions.slice(0, 4);

      } catch (jsonError) {
        console.error('JSON parsing failed. Attempted fix failed. Raw response was:', responseText.substring(0, 500));
        throw new Error('AI returned unparseable JSON.');
      }

    } catch (error) {
      console.error('Smart questions generation failed (using fallback):', error.message);
      return this.getFallbackQuestions();
    }
  }
  async answerQuestion(question, documentText, language = 'en') {
    try {
      if (!vertexAI) {
        return "I'm having trouble accessing AI services right now. Please try asking a more specific question about the document's terms, obligations, or key provisions.";
      }

      const model = vertexAI.getGenerativeModel({
        model: await getAvailableModel(),
      });

      const languageInstruction = language !== 'en'
        ? `Answer in ${this.getLanguageName(language)}.`
        : '';

      const prompt = `
          ${languageInstruction}
          Answer this question about the legal document in simple, clear language. 
          Use ONLY the provided Document Text as context. If the answer is not available, state that you cannot find it.
          
          Question: ${question}
          
          // ⬇️ CRITICAL FIX: Use the full 4000 characters for optimal grounding
          Document Text: ${documentText.substring(0, 32000)} 
          
          Answer (be specific and helpful):
        `;

      const result = await this.withTimeout(
        model.generateContent(prompt),
        10000,
        1
      );

      return result.response.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error('Error answering question:', error);
      return "I'm having trouble processing your question right now. This might be due to high demand on our AI services. Please try rephrasing your question or asking about specific terms, deadlines, or obligations in the document.";
    }
  }
}