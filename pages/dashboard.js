// pages/dashboard.js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../lib/authContext';
import { firestoreService } from '../lib/firestoreService';
import UserProfile from '../components/UserProfile';
import DocumentSummary from '../components/DocumentSummary';
import ChatInterface from '../components/ChatInterface';
import KeyTermsExtracted, { extractDateTerms } from '../components/KeyTermsExtracted';
import LanguageSelector from '../components/LanguageSelector';
import UploadPage from '../components/UploadPage';
import ProcessingPage from '../components/ProcessingPage';
import ImportantClauseList from '../components/ImportantClauseList';
import ActionChecklist, { formatTermDate } from '../components/ActionChecklist'; // <-- CRITICAL: Import formatTermDate
// NEW IMPORTS FOR TTS
import TextToSpeechButton from '../components/TextToSpeechButton';
import {
  extractFinancialTerms,
  extractNoticePeriods,
  extractPenalties
} from '../components/KeyTermsExtracted';
// END NEW IMPORTS

import { Loader, Upload, History, Clock, ArrowLeft, GitCompare, Gavel } from 'lucide-react';

// Define view states
const VIEW_STATES = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  RESULTS: 'results',
};

// Storage keys
const STORAGE_KEYS = {
  DOCUMENT_ID: 'currentDocId',
  LANGUAGE: 'selectedLanguage',
};

// Date translations
const dateTranslations = {
  en: {
    importantDateType: 'Important Date',
    startDateType: 'Start Date',
    endDateType: 'End Date',
    dueDateType: 'Due Date',
    updateDateType: 'Update Date',
  },
  de: {
    importantDateType: 'Wichtige Daten',
    startDateType: 'Anfangsdatum',
    endDateType: 'Enddatum',
    dueDateType: 'Fälligkeitsdatum',
    updateDateType: 'Aktualisierungsdatum',
  },
  es: {
    importantDateType: 'Fecha Importante',
    startDateType: 'Fecha de Inicio',
    endDateType: 'Fecha de Fin',
    dueDateType: 'Fecha de Vencimiento',
    updateDateType: 'Fecha de Actualización',
  },
  fr: {
    importantDateType: 'Date Importante',
    startDateType: 'Date de Début',
    endDateType: 'Date de Fin',
    dueDateType: 'Date d\'échéance',
    updateDateType: 'Date de Mise à Jour',
  },
  hi: {
    importantDateType: 'महत्वपूर्ण तिथि',
    startDateType: 'प्रारंभ तिथि',
    endDateType: 'समाप्ति तिथि',
    dueDateType: 'नियत तिथि',
    updateDateType: 'अद्यतन तिथि',
  }
};

// NEW HELPER FUNCTION TO AGGREGATE TEXT FOR READING
const getAggregatedTextToRead = (documentData, dateTerms) => {
  if (!documentData || !documentData.summary) return '';

  let summaryText = documentData.summary;

  // STEP 1: Split by ## headers to get sections
  const sections = summaryText.split(/\n##\s+/);

  let aggregatedText = '';

  // STEP 2: Process each section (skip the first "Main Facts" section)
  sections.slice(1).forEach((section, index) => {
    // Split section into heading and content
    const lines = section.split('\n');
    const heading = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();

    // Add the heading naturally
    if (heading) {
      aggregatedText += `${heading}. `;
    }

    // Clean and add the content
    if (content) {
      let cleanContent = content
        // Remove bold markers but keep the text
        .replace(/\*\*([^*]+)\*\*/g, '$1')

        // Remove italic markers
        .replace(/\*([^*]+)\*/g, '$1')

        // Remove remaining asterisks
        .replace(/\*/g, '')

        // Remove bullet points (-, *, •)
        .replace(/^\s*[-*•]\s+/gm, '')

        // Remove numbered lists (1., 2., etc.)
        .replace(/^\s*\d+\.\s+/gm, '')

        // Keep field labels but make them natural for speech
        // "**Landlord:** John" becomes "Landlord John"
        .replace(/\*\*([^*:]+):\*\*/g, '$1,')
        .replace(/([^:]+):/g, '$1,')

        // Clean up whitespace
        .replace(/\n+/g, '. ')
        .replace(/\s+/g, ' ')
        .replace(/\.\s*\./g, '.')
        .trim();

      // Add content with natural pauses
      aggregatedText += cleanContent + '. ';
    }
  });

  // STEP 3: Add important clauses with their types
  if (documentData.clauses && documentData.clauses.length > 0) {
    aggregatedText += 'Important clauses include the following. ';

    documentData.clauses.slice(0, 4).forEach((clause) => {
      // Clean the explanation
      let explanation = clause.explanation
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s*/g, '')
        .trim();

      // Add clause type and explanation
      if (explanation.length > 20) {
        aggregatedText += `${clause.type}. ${explanation}. `;
      }
    });
  }

  // STEP 4: Final cleanup for natural speech
  aggregatedText = aggregatedText
    .replace(/\s+/g, ' ')           // Single spaces
    .replace(/\.\s*\./g, '.')       // Remove double periods
    .replace(/\.\s*,/g, ',')        // Fix period-comma issues
    .replace(/,\s*\./g, '.')        // Fix comma-period issues
    .replace(/\s+\./g, '.')         // Remove space before period
    .replace(/\s+,/g, ',')          // Remove space before comma
    .trim();

  // Log for debugging
  console.log('=== TTS TEXT (First 500 chars) ===');
  console.log(aggregatedText.substring(0, 500));
  console.log('===================================');

  return aggregatedText;
};

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { docId, returnTo } = router.query; // returnTo tells us where we came from

  const [documentData, setDocumentData] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [viewState, setViewState] = useState(null);
  const [languageDetection, setLanguageDetection] = useState(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [translationCache, setTranslationCache] = useState({});
  const [availableLanguages, setAvailableLanguages] = useState(['en']);
  const [loadingFromHistory, setLoadingFromHistory] = useState(false);

  // Processing States for progress bar animation
  const [processingProgress, setProcessingProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processingProfile, setProcessingProfile] = useState({});

  // Add refs to track loading state
  const isLoadingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Date Extraction Logic for the new split layout
  const keyDateTerms = documentData?.originalText
    ? extractDateTerms(documentData.originalText, selectedLanguage, dateTranslations)
    : [];

  // NEW: Calculate the aggregated text for Text-to-Speech
  const textToRead = getAggregatedTextToRead(documentData, keyDateTerms);


  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Update last active
  useEffect(() => {
    if (user) {
      firestoreService.updateLastActive(user.uid);
    }
  }, [user]);

  // MAIN INITIALIZATION EFFECT - Only runs once after auth is ready
  useEffect(() => {
    if (user && !authLoading && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initializeDashboard();
    }
  }, [user, authLoading]);

  // SEPARATE EFFECT - Handle docId changes from URL
  useEffect(() => {
    if (user && !authLoading && hasInitializedRef.current && docId && !isLoadingRef.current) {
      // Only load if the docId is different from current document
      if (!documentData || documentData.firestoreDocId !== docId) {
        const persistedLanguage = typeof window !== 'undefined'
          ? localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'en'
          : 'en';
        loadDocumentFromHistory(docId, persistedLanguage);
      }
    }
  }, [docId, user, authLoading]);

  const initializeDashboard = async () => {
    const persistedDocId = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.DOCUMENT_ID)
      : null;
    const persistedLanguage = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'en'
      : 'en';

    const targetDocId = docId || persistedDocId;

    if (targetDocId) {
      await loadDocumentFromHistory(targetDocId, persistedLanguage);

      // Update URL if needed
      if (persistedDocId && !docId) {
        router.push(`/dashboard?docId=${persistedDocId}`, undefined, { shallow: true });
      }
    } else {
      setViewState(VIEW_STATES.UPLOAD);
    }
  };

  // Progress Simulation Logic
  useEffect(() => {
    let interval;
    if (viewState === VIEW_STATES.PROCESSING && processingProgress < 95) {
      interval = setInterval(() => {
        setProcessingProgress(prev => {
          const increment = Math.random() * 5 + 1;
          return Math.min(95, prev + increment);
        });
      }, 800);
    } else if (viewState !== VIEW_STATES.PROCESSING) {
      clearInterval(interval);
      setProcessingProgress(0);
    }
    return () => clearInterval(interval);
  }, [viewState, processingProgress]);


  const loadDocumentFromHistory = async (firestoreDocId, targetLanguage = 'en') => {
    if (!firestoreDocId || !user || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setLoadingFromHistory(true);

    try {
      const doc = await firestoreService.getDocument(user.uid, firestoreDocId);

      if (doc && doc.fullData) {
        const loadedData = {
          id: doc.documentId,
          fileName: doc.fileName,
          fileType: doc.fileType,
          summary: doc.fullData.summary || doc.summary,
          clauses: doc.fullData.clauses || [],
          smartQuestions: doc.fullData.smartQuestions || [],
          originalText: doc.fullData.originalText || '',
          firestoreDocId: firestoreDocId
        };

        const detectedLang = doc.detectedLanguage || 'en';
        setLanguageDetection({
          detected: detectedLang,
          confidence: doc.languageConfidence || 0
        });

        let finalDocData = loadedData;

        if (targetLanguage !== detectedLang) {
          const cachedTranslation = await firestoreService.getTranslation(
            doc.documentId,
            targetLanguage
          );
          if (cachedTranslation) {
            finalDocData = cachedTranslation;
          } else {
            targetLanguage = detectedLang;
          }
        }

        setDocumentData(finalDocData);
        setSelectedLanguage(targetLanguage);

        setTranslationCache({
          [targetLanguage]: {
            data: finalDocData,
            cachedAt: new Date().toISOString(),
            isOriginal: targetLanguage === detectedLang
          }
        });

        const translations = await firestoreService.getAvailableTranslations(doc.documentId);
        setAvailableLanguages([detectedLang, ...translations].filter((v, i, a) => a.indexOf(v) === i));

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.DOCUMENT_ID, doc.documentId);
          localStorage.setItem(STORAGE_KEYS.LANGUAGE, targetLanguage);
        }

        setViewState(VIEW_STATES.RESULTS);

      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.DOCUMENT_ID);
          localStorage.removeItem(STORAGE_KEYS.LANGUAGE);
        }
        router.push('/dashboard', undefined, { shallow: true });
        setViewState(VIEW_STATES.UPLOAD);
      }
    } catch (error) {
      console.error('Error loading document:', error);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.DOCUMENT_ID);
        localStorage.removeItem(STORAGE_KEYS.LANGUAGE);
      }
      setViewState(VIEW_STATES.UPLOAD);
    } finally {
      setLoadingFromHistory(false);
      isLoadingRef.current = false;
    }
  };


  const handleProcessingStart = async (file, profile) => {
    setViewState(VIEW_STATES.PROCESSING);
    setUploadedFile(file);
    setProcessingProfile(profile);
    setProcessingProgress(10);

    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setProcessingProgress(100);
        setTimeout(() => handleDocumentProcessed(result.data, result.languageDetection), 500);

      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      alert(err.message || 'Failed to process document. Please try again.');
      setViewState(VIEW_STATES.UPLOAD);
    }
  };


  const handleDocumentProcessed = async (data, detectionInfo = null) => {
    setDocumentData(data);

    if (detectionInfo && data) {
      setLanguageDetection(detectionInfo);

      const detectedLang = detectionInfo.detected || 'en';

      const documentId = data.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let savedDocId = null;
      if (user) {
        try {
          savedDocId = await firestoreService.saveDocument(user.uid, {
            documentId: documentId,
            fileName: data.fileName || 'Untitled Document',
            fileType: data.fileType || 'application/pdf',
            summary: data.summary || '',
            detectedLanguage: detectedLang,
            languageConfidence: detectionInfo.confidence || 0,
            clauseCount: data.clauses?.length || 0,
            fullData: {
              summary: data.summary,
              clauses: data.clauses,
              smartQuestions: data.smartQuestions,
              originalText: data.originalText
            }
          });

          setDocumentData(prev => ({
            ...prev,
            id: documentId,
            firestoreDocId: savedDocId
          }));

          await firestoreService.incrementDocumentCount(user.uid);

          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.DOCUMENT_ID, documentId);
            localStorage.setItem(STORAGE_KEYS.LANGUAGE, detectedLang);
          }
          router.push(`/dashboard?docId=${savedDocId}`, undefined, { shallow: true });

        } catch (error) {
          alert('Warning: Document was processed but could not be saved to history.');
        }
      }

      setTranslationCache({
        [detectedLang]: {
          data: data,
          cachedAt: new Date().toISOString(),
          isOriginal: true
        }
      });
      setAvailableLanguages([detectedLang]);
      setSelectedLanguage(detectedLang);
    }

    setViewState(VIEW_STATES.RESULTS);
  };

  const handleLanguageChange = async (newLanguage) => {
    if (!documentData) {
      setSelectedLanguage(newLanguage);
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, newLanguage);
    }

    const cachedTranslation = await firestoreService.getTranslation(
      documentData.id,
      newLanguage
    );

    if (cachedTranslation) {
      setSelectedLanguage(newLanguage);
      setDocumentData(cachedTranslation);
      return;
    }

    if (translationCache[newLanguage]) {
      setSelectedLanguage(newLanguage);
      setDocumentData(translationCache[newLanguage].data);
      return;
    }

    await regenerateInNewLanguage(newLanguage);
  };

  const regenerateInNewLanguage = async (targetLanguage) => {
    if (!documentData) return;

    setIsRegenerating(true);

    try {
      const response = await fetch('/api/reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: documentData.id,
          newLanguage: targetLanguage,
          documentData: documentData,
          userId: user.uid
        })
      });

      const result = await response.json();

      if (result.success) {
        setSelectedLanguage(targetLanguage);

        await firestoreService.cacheTranslation(
          documentData.id,
          targetLanguage,
          result.data
        );

        setTranslationCache(prev => ({
          ...prev,
          [targetLanguage]: {
            data: result.data,
            cachedAt: new Date().toISOString()
          }
        }));

        if (!availableLanguages.includes(targetLanguage)) {
          setAvailableLanguages(prev => [...prev, targetLanguage]);
        }

        setDocumentData(result.data);
      }
    } catch (error) {
      alert('Failed to translate document. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleNewDocument = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.DOCUMENT_ID);
      localStorage.removeItem(STORAGE_KEYS.LANGUAGE);
    }

    setDocumentData(null);
    setLanguageDetection(null);
    setTranslationCache({});
    setAvailableLanguages(['en']);
    setSelectedLanguage('en');
    setViewState(VIEW_STATES.UPLOAD);
    router.push('/dashboard', undefined, { shallow: true });
  };

  // Handle back button navigation
  const handleBackNavigation = () => {
    if (returnTo === 'history') {
      router.push('/history');
    } else if (returnTo === 'subscription') {
      router.push('/subscription');
    } else {
      // Default: go to history
      router.push('/history');
    }
  };


  // Loading state 
  if (authLoading || loadingFromHistory || (viewState === null && user)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">
            {loadingFromHistory ? 'Loading document...' : 'Initializing...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Head>
        <title>Legal Document Demystifier</title>
      </Head>

      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center py-3 sm:py-6 gap-3">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              {/* Show back button when viewing a document AND came from somewhere specific */}
              {docId && returnTo && (
                <button
                  onClick={handleBackNavigation}
                  className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                  title={`Back to ${returnTo === 'history' ? 'History' : 'Previous Page'}`}
                >
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              )}

              <div className="min-w-0">
                <h1
                  onClick={handleNewDocument}
                  className="text-lg sm:text-2xl lg:text-3xl font-bold text-white cursor-pointer hover:text-blue-400 transition-colors truncate"
                >
                  Legal Document Demystifier
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 flex-shrink-0">

              {documentData && (
                <TextToSpeechButton
                  textToRead={textToRead} // PASS THE AGGREGATED TEXT
                  selectedLanguage={selectedLanguage}
                  isTranslating={isRegenerating}
                />
              )}

              {documentData && (
                <Link
                  href={`/subscription?docId=${documentData.firestoreDocId || ''}`}
                  passHref
                >
                  <button className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 border border-red-600 rounded-lg bg-red-700 hover:bg-red-600 transition-colors text-white font-medium text-sm">
                    <Gavel className="h-4 w-4" />
                    <span className="hidden md:inline">Get Legal Advice</span>
                  </button>
                </Link>
              )}

              <Link
                href={documentData?.firestoreDocId ? `/history?currentDoc=${documentData.firestoreDocId}` : '/history'}
                passHref
              >
                <button className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-white text-sm">
                  <History className="h-4 w-4" />
                  <span className="hidden md:inline">History</span>
                </button>
              </Link>

              {documentData && (
                <LanguageSelector
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={handleLanguageChange}
                  showDetectedLanguage={languageDetection?.detected}
                  availableLanguages={availableLanguages}
                  isTranslating={isRegenerating}
                />
              )}

              <UserProfile />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* State Rendering */}
        {viewState === VIEW_STATES.UPLOAD && (
          <UploadPage
            onProcessingStart={handleProcessingStart}
          />
        )}

        {viewState === VIEW_STATES.PROCESSING && (
          <ProcessingPage
            fileName={uploadedFile?.name || 'Your Document'}
            progress={processingProgress}
            onBack={handleNewDocument}
          />
        )}

        {viewState === VIEW_STATES.RESULTS && documentData && (
          <div className="space-y-8">
            {/* 1. Document Summary & Preview */}
            <DocumentSummary documentData={documentData} language={selectedLanguage} />

            {/* 2. Chat Interface */}
            <ChatInterface documentData={documentData} language={selectedLanguage} />

            {/* 3. AI-Identified Important Clauses */}
            <ImportantClauseList clauses={documentData.clauses} language={selectedLanguage} />
            {/* 4. KEY TERMS AND ACTION PANEL (NEW LAYOUT) */}
            {/* LEFT: Key Financial/Penalty/Notice Terms */}
            <KeyTermsExtracted
              documentData={documentData}
              language={selectedLanguage}
            />

            {/* RIGHT: Action Checklist and Dates/Calendar */}
            {/* <ActionChecklist 
                    documentData={documentData}
                    dateTerms={keyDateTerms}
                    language={selectedLanguage} 
                /> */}

            <div className="text-center pt-8 border-t border-gray-700">
              <button
                onClick={handleNewDocument}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center mx-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                Process New Document
              </button>
            </div>
          </div>
        )}

        {/* Processing State for Translation (if re-analyzing) */}
        {isRegenerating && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader className="h-12 w-12 text-blue-500 animate-spin mx-auto" />
              <p className="mt-4 text-gray-300 font-medium">
                Translating document...
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}