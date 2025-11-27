// components/KeyTermsExtracted.js

import { useState } from 'react';
import { DollarSign, AlertTriangle, Clock, FileText, ChevronDown, ChevronUp, Globe, Calendar, Heart, Bell } from 'lucide-react';
import PlainLanguageRewriter from './PlainLanguageRewriter';
import { formatTermDate, createGoogleCalendarUrl } from './ActionChecklist';

// --- EXPORTED EXTRACTION FUNCTIONS (Used by Dashboard and this component) ---

export const extractFinancialTerms = (fullText) => {
  const terms = [];
  const textToSearch = fullText;

  if (!textToSearch || textToSearch.length === 0) {
    return [];
  }

  const currencyPatterns = [
    { pattern: /\$[\d,]+(?:\.\d{2})?/g, name: 'USD' },
    { pattern: /€[\d\s,]+(?:[.,]\d{2})?/g, name: 'EUR' },
    { pattern: /£[\d,]+(?:\.\d{2})?/g, name: 'GBP' },
    { pattern: /₹[\d,]+(?:\.\d{2})?/g, name: 'INR-Symbol' },
    { pattern: /\bRs\.?\s+[\d,]+(?:\.\d{2})?/g, name: 'INR-Rs' },
    { pattern: /\bINR\s+[\d,]+(?:\.\d{2})?/g, name: 'INR-Code' },
    { pattern: /[\d,]+(?:\.\d{2})?\s+Rupees/g, name: 'INR-Word' },
    { pattern: /\([\d,]+(?:\.\d{2})?\s*Rupees(?:\s+only)?\)/g, name: 'INR-Paren' }
  ];

  let allMatches = [];
  const seenPositions = new Set();

  currencyPatterns.forEach(({ pattern, name }) => {
    const regex = new RegExp(pattern.source, 'g');
    let match;

    while ((match = regex.exec(textToSearch)) !== null) {
      const index = match.index;
      const matchedText = match[0].trim();

      let isOverlapping = false;
      for (let seenPos of seenPositions) {
        if (Math.abs(index - seenPos) < 5) {
          isOverlapping = true;
          break;
        }
      }

      if (isOverlapping) {
        continue;
      }

      seenPositions.add(index);
      allMatches.push({
        amount: matchedText,
        index,
        patternName: name
      });
    }
  });

  allMatches.forEach(({ amount, index }) => {
    const contextStart = Math.max(0, index - 80);
    const contextEnd = Math.min(textToSearch.length, index + amount.length + 80);
    const context = textToSearch.substring(contextStart, contextEnd).trim();
    const lowerContext = context.toLowerCase();

    let type = 'Payment';

    if (lowerContext.match(/security\s+deposit/i)) {
      type = 'Security Deposit';
    } else if (lowerContext.match(/monthly\s+rent|rent\s+for/i)) {
      type = 'Monthly Rent';
    } else if (lowerContext.match(/\brent\b/i)) {
      type = 'Rent';
    } else if (lowerContext.match(/\bdeposit\b/i)) {
      type = 'Deposit';
    }

    terms.push({
      amount,
      type,
      context: context.length > 120 ? '...' + context + '...' : context,
      clauseType: 'general',
      originalIndex: index
    });
  });

  const seen = new Set();
  const uniqueTerms = terms.filter(term => {
    const normalizedAmount = term.amount.replace(/[₹$€£,\s()]/g, '');
    const key = `${normalizedAmount}-${term.type}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return uniqueTerms;
};

export const extractDateTerms = (fullText, language, translations) => {
  const terms = [];
  const textToSearch = fullText;

  // Robust Multi-language date patterns
  const datePatterns = [
    /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
    /\d{1,2}-\d{1,2}-\d{2,4}/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{4}/gi,
    /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}\b/gi,
    /\b(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/gi,
    /\b\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}\b/gi,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    // FIX: Added more general month/year and day/month/year patterns for robustness
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\b/gi,
    /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\b/gi,
  ];

  const t = translations[language] || translations.en;

  datePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(textToSearch)) !== null) {
      const date = match[0];
      const index = match.index;
      const contextStart = Math.max(0, index - 40);
      const contextEnd = Math.min(textToSearch.length, index + date.length + 40);
      const context = textToSearch.substring(contextStart, contextEnd).trim();

      let typeKey = 'importantDateType';
      const lowerContext = context.toLowerCase();

      if (lowerContext.match(/begin|start|início|comienzo|début|beginn|inizio|efectiva/i)) {
        typeKey = 'startDateType';
      } else if (lowerContext.match(/end|expir|término|fin|vencimiento|échéance|ablauf|scadenza/i)) {
        typeKey = 'endDateType';
      } else if (lowerContext.match(/due|vencimiento|échéance|fällig|scadenza|pagamento/i)) {
        typeKey = 'dueDateType';
      } else if (lowerContext.match(/actualización|update|mise à jour|aktualisierung|aggiornamento|última actualización/i)) {
        typeKey = 'updateDateType';
      }

      const type = t[typeKey] || typeKey;

      terms.push({ date, type, context: '...' + context + '...', originalIndex: index });
    }
  });

  return terms.filter((term, index, self) =>
    index === self.findIndex(t => t.date === term.date)
  );
};

export const extractNoticePeriods = (fullText, language) => {
  const terms = [];
  const textToSearch = fullText;

  const noticePatterns = [
    /(\d+)\s+(?:days?|días?|jours?|tage|giorni|dias?)\s+(?:written\s+)?(?:notice|aviso|préavis|kündigungsfrist|preavviso|prior|before|grace)/gi,
    /(?:notice|aviso|préavis|kündigungsfrist|preavviso)\s+(?:of|de)\s+(\d+)\s+(?:days?|días?|jours?|tage|giorni|dias?)/gi
  ];

  noticePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(textToSearch)) !== null) {
      const days = match[1];
      const index = match.index;
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(textToSearch.length, index + match[0].length + 50);
      const context = textToSearch.substring(contextStart, contextEnd).trim();
      const lowerContext = context.toLowerCase();

      let type = 'Notice Period';
      if (lowerContext.match(/grace|gracia|délai de grâce|schonfrist/i)) {
        type = 'Grace Period';
      } else if (lowerContext.match(/terminat|cancel|rescind|resiliación|résiliation|kündigung/i)) {
        type = 'Termination Notice';
      } else if (lowerContext.match(/late|retraso|retard|verspätung|mora/i)) {
        type = 'Late Payment Grace';
      }

      terms.push({
        period: `${days} ${language === 'es' ? 'días' : language === 'fr' ? 'jours' : 'days'}`,
        type,
        context: '...' + context + '...',
        isGracePeriod: type === 'Grace Period',
        originalIndex: index
      });
    }
  });

  return terms.filter((term, index, self) =>
    index === self.findIndex(t => t.originalIndex === term.originalIndex)
  );
};

export const extractPenalties = (fullText, language) => {
  const terms = [];
  const textToSearch = fullText;
  const lowerText = textToSearch.toLowerCase();

  const penaltyKeywords = {
    en: ['penalty', 'fine', 'breach', 'violation', 'forfeit', 'fee', 'late fee', 'eviction'],
    es: ['penalización', 'multa', 'incumplimiento', 'violación', 'pérdida', 'tarifa', 'cargo', 'desalojo'],
    fr: ['pénalité', 'amende', 'violation', 'manquement', 'perte', 'frais', 'expulsion'],
    de: ['strafe', 'bußgeld', 'verletzung', 'verstoß', 'verlust', 'gebühr', 'räumung'],
    hi: ['दंड', 'जुर्माना', 'उल्लंघन', 'हानि', 'शुल्क', 'बेदखली']
  };

  const keywords = penaltyKeywords[language] || penaltyKeywords.en;
  const seenContexts = new Set();

  keywords.forEach(keyword => {
    let regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    let match;
    while ((match = regex.exec(lowerText)) !== null) {
      const index = match.index;
      const contextStart = Math.max(0, index - 60);
      const contextEnd = Math.min(textToSearch.length, index + keyword.length + 100);
      const context = textToSearch.substring(contextStart, contextEnd).trim();
      const contextFingerprint = context.substring(0, 100).toLowerCase().trim();

      if (seenContexts.has(contextFingerprint)) {
        continue;
      }
      seenContexts.add(contextFingerprint);

      const amountPatterns = [
        /\$[\d,]+(?:\.\d{2})?/g,
        /€[\d\s,]+(?:[.,]\d{2})?/g,
        /£[\d,]+(?:\.\d{2})?/g,
        /₹[\d,]+(?:\.\d{2})?/g
      ];

      let amounts = [];
      amountPatterns.forEach(pattern => {
        const matches = context.match(pattern) || [];
        amounts = amounts.concat(matches);
      });

      let severity = 'medium';
      const contextLower = context.toLowerCase();
      if (contextLower.match(/immediately|inmediatamente|immédiatement|sofort|forfeit|pérdida|perte|evict|desalojo/i)) {
        severity = 'high';
      } else if (contextLower.match(/may|could|puede|pourrait|könnte/i)) {
        severity = 'low';
      }

      const riskScore = severity === 'high' ? 5 : (severity === 'medium' ? 3 : 1);

      terms.push({
        type: keyword.charAt(0).toUpperCase() + keyword.slice(1),
        severity,
        amounts,
        context: context.length > 120 ? '...' + context + '...' : context,
        riskScore,
        originalIndex: index
      });
    }
  });

  return terms;
};
// --- END EXPORTED FUNCTIONS ---


export default function KeyTermsExtracted({ documentData, language }) {
  const [expandedSections, setExpandedSections] = useState({
    financial: true,
    penalties: true,
    notices: true,
    dates: true
  });

  const isTranslated = language !== 'en';

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Translation dictionaries (EXPANDED FOR MULTILINGUAL SUPPORT)
  const translations = {
    en: {
      title: 'Key Terms (Financial, Notices, Penalties)',
      subtitle: 'Specific financial and risk values identified in your document',
      translationNotice: 'Reference text excerpts below are shown in the original document language for accuracy.',
      referenceLabel: 'Reference (original language):',
      financialTerms: 'Financial Terms',
      importantDates: 'Important Dates',
      noticePeriods: 'Notice Periods & Deadlines',
      penalties: 'Penalties & Consequences',
      found: 'found',
      highRisk: 'HIGH RISK',
      mediumRisk: 'MEDIUM RISK',
      lowRisk: 'LOW RISK',
      emptyState: 'No specific key terms could be automatically extracted from this document.',
      emptyStateSubtitle: 'Review the full document summary and use the chat feature to ask specific questions.',
      note: 'Note:',
      importantDateType: 'Important Date',
      startDateType: 'Start Date',
      endDateType: 'End Date',
      dueDateType: 'Due Date',
      updateDateType: 'Update Date',
      setCalendarTitle: 'Set Calendar',
      setCalendarSubtitle: 'Use the "Add to Calendar" buttons for one-click reminder creation.',
      rawLabel: 'Raw:',
      addToCalendar: 'Add to Calendar',
      dateFormatError: 'Date format not recognized'
    },
    de: {
      title: 'Schlüsselbegriffe (Finanzen, Fristen, Strafen)',
      subtitle: 'Spezifische finanzielle und Risikowerte in Ihrem Dokument',
      translationNotice: 'Referenztextauszüge werden zur Genauigkeit in der Originalsprache des Dokuments angezeigt.',
      referenceLabel: 'Referenz (Originalsprache):',
      financialTerms: 'Finanzielle Bedingungen',
      importantDates: 'Wichtige Daten',
      noticePeriods: 'Kündigungsfristen und Termine',
      penalties: 'Strafen und Konsequenzen',
      found: 'gefunden',
      highRisk: 'HOHES RISIKO',
      mediumRisk: 'MITTLERES RISIKO',
      lowRisk: 'GERINGES RISIKO',
      emptyState: 'Aus diesem Dokument konnten keine spezifischen Schlüsselbegriffe automatisch extrahiert werden.',
      emptyStateSubtitle: 'Überprüfen Sie die vollständige Dokumentzusammenfassung und verwenden Sie die Chat-Funktion für spezifische Fragen.',
      note: 'Hinweis:',
      importantDateType: 'Wichtige Daten',
      startDateType: 'Anfangsdatum',
      endDateType: 'Enddatum',
      dueDateType: 'Fälligkeitsdatum',
      updateDateType: 'Aktualisierungsdatum',
      setCalendarTitle: 'Kalender setzen',
      setCalendarSubtitle: 'Verwenden Sie die Schaltflächen "Zum Kalender hinzufügen" für Erinnerungen.',
      rawLabel: 'Rohdaten:',
      addToCalendar: 'Zum Kalender hinzufügen',
      dateFormatError: 'Datumsformat nicht erkannt'
    },
    es: {
      title: 'Términos Clave (Financieros, Avisos, Penalizaciones)',
      subtitle: 'Valores financieros y de riesgo específicos identificados en su documento',
      translationNotice: 'Los extractos de texto de referencia se muestran en el idioma original del documento para mayor precisión.',
      referenceLabel: 'Referencia (idioma original):',
      financialTerms: 'Términos Financieros',
      importantDates: 'Fechas Importantes',
      noticePeriods: 'Períodos de Aviso y Plazos',
      penalties: 'Penalizaciones y Consecuencias',
      found: 'encontrado',
      highRisk: 'ALTO RIESGO',
      mediumRisk: 'RIESGO MEDIO',
      lowRisk: 'BAJO RIESGO',
      emptyState: 'No se pudieron extraer automáticamente términos clave específicos de este documento.',
      emptyStateSubtitle: 'Revise el resumen completo del documento y use la función de chat para hacer preguntas específicas.',
      note: 'Nota:',
      importantDateType: 'Fecha Importante',
      startDateType: 'Fecha de Inicio',
      endDateType: 'Fecha de Fin',
      dueDateType: 'Fecha de Vencimiento',
      updateDateType: 'Fecha de Actualización',
      setCalendarTitle: 'Establecer Calendario',
      setCalendarSubtitle: 'Utilice los botones "Agregar al Calendario" para crear recordatorios.',
      rawLabel: 'Crudo:',
      addToCalendar: 'Agregar al Calendario',
      dateFormatError: 'Formato de fecha no reconocido'
    },
    hi: {
      title: 'मुख्य शर्तें (वित्तीय, नोटिस, दंड)',
      subtitle: 'आपके दस्तावेज़ में पहचानी गई विशिष्ट वित्तीय और जोखिम राशियाँ',
      translationNotice: 'संदर्भ पाठ अंश मूल दस्तावेज़ भाषा में सटीकता के लिए दिखाए गए हैं।',
      referenceLabel: 'संदर्भ (मूल भाषा):',
      financialTerms: 'वित्तीय शर्तें',
      importantDates: 'महत्वपूर्ण तिथियाँ',
      noticePeriods: 'नोटिस अवधि और समय सीमा',
      penalties: 'दंड और परिणाम',
      found: 'मिला',
      highRisk: 'उच्च जोखिम',
      mediumRisk: 'मध्यम जोखिम',
      lowRisk: 'कम जोखिम',
      emptyState: 'इस दस्तावेज़ से कोई विशिष्ट मुख्य शर्तें स्वचालित रूप से नहीं निकाली जा सकीं।',
      emptyStateSubtitle: 'पूर्ण दस्तावेज़ सारांश की समीक्षा करें और विशिष्ट प्रश्न पूछने के लिए चैट सुविधा का उपयोग करें।',
      note: 'नोट:',
      importantDateType: 'महत्वपूर्ण तिथि',
      startDateType: 'प्रारंभ तिथि',
      endDateType: 'समाप्ति तिथि',
      dueDateType: 'नियत तिथि',
      updateDateType: 'अद्यतन तिथि',
      setCalendarTitle: 'कैलेंडर सेट करें',
      setCalendarSubtitle: 'वन-क्लिक रिमाइंडर बनाने के लिए "कैलेंडर में जोड़ें" बटन का उपयोग करें।',
      rawLabel: 'मूल डेटा:',
      addToCalendar: 'कैलेंडर में जोड़ें',
      dateFormatError: 'तिथि प्रारूप नहीं पहचाना गया'
    },
    bn: {
      title: 'মূল শর্তাবলী (আর্থিক, নোটিশ, জরিমানা)',
      subtitle: 'আপনার নথিতে চিহ্নিত নির্দিষ্ট আর্থিক এবং ঝুঁকির মান',
      translationNotice: 'সঠিকতার জন্য রেফারেন্স পাঠ্যের অংশগুলি মূল নথির ভাষায় দেখানো হয়েছে।',
      referenceLabel: 'রেফারেন্স (মূল ভাষা):',
      financialTerms: 'আর্থিক শর্তাবলী',
      importantDates: 'গুরুত্বপূর্ণ তারিখগুলি',
      noticePeriods: 'নোটিশের সময়কাল এবং সময়সীমা',
      penalties: 'জরিমানা এবং পরিণতি',
      found: 'পাওয়া গেছে',
      highRisk: 'উচ্চ ঝুঁকি',
      mediumRisk: 'মাঝারি ঝুঁকি',
      lowRisk: 'কম ঝুঁকি',
      emptyState: 'এই নথি থেকে স্বয়ংক্রিয়ভাবে কোনো নির্দিষ্ট মূল শর্তাবলী বের করা যায়নি।',
      emptyStateSubtitle: 'সম্পূর্ণ নথির সারাংশ পর্যালোচনা করুন এবং নির্দিষ্ট প্রশ্ন জিজ্ঞাসা করতে চ্যাট বৈশিষ্ট্যটি ব্যবহার করুন।',
      note: 'দ্রষ্টব্য:',
      importantDateType: 'গুরুত্বপূর্ণ তারিখ',
      startDateType: 'শুরুর তারিখ',
      endDateType: 'শেষের তারিখ',
      dueDateType: 'পরিশোধের তারিখ',
      updateDateType: 'আপডেট তারিখ',
      setCalendarTitle: 'ক্যালেন্ডার সেট করুন',
      setCalendarSubtitle: 'এক-ক্লিকে রিমাইন্ডার তৈরির জন্য "ক্যালেন্ডারে যোগ করুন" বোতামগুলি ব্যবহার করুন।',
      rawLabel: 'কাঁচা:',
      addToCalendar: 'ক্যালেন্ডারে যোগ করুন',
      dateFormatError: 'তারিখের বিন্যাস স্বীকৃত নয়'
    },
    te: {
      title: 'ముఖ్య నిబంధనలు (ఆర్థిక, నోటీసులు, జరిమానాలు)',
      subtitle: 'మీ పత్రంలో గుర్తించబడిన నిర్దిష్ట ఆర్థిక మరియు ప్రమాద విలువలు',
      translationNotice: 'ఖచ్చితత్వం కోసం రిఫరెన్స్ టెక్స్ట్ సారాంశాలు అసలు పత్రం భాషలో చూపబడతాయి.',
      referenceLabel: 'సూచన (అసలు భాష):',
      financialTerms: 'ఆర్థిక నిబంధనలు',
      importantDates: 'ముఖ్యమైన తేదీలు',
      noticePeriods: 'నోటీసు కాలాలు & గడువులు',
      penalties: 'జరిమానాలు & పరిణామాలు',
      found: 'దొరికినవి',
      highRisk: 'అధిక ప్రమాదం',
      mediumRisk: 'మధ్యస్థ ప్రమాదం',
      lowRisk: 'తక్కువ ప్రమాదం',
      emptyState: 'ఈ పత్రం నుండి నిర్దిష్ట ముఖ్య నిబంధనలు స్వయంచాలకంగా సంగ్రహించబడలేదు.',
      emptyStateSubtitle: 'పూర్తి పత్రం సారాంశాన్ని సమీక్షించండి మరియు నిర్దిష్ట ప్రశ్నలు అడగడానికి చాట్ ఫీచర్‌ను ఉపయోగించండి.',
      note: 'గమనిక:',
      importantDateType: 'ముఖ్యమైన తేదీ',
      startDateType: 'ప్రారంభ తేదీ',
      endDateType: 'ముగింపు తేదీ',
      dueDateType: 'గడువు తేదీ',
      updateDateType: 'నవీకరణ తేదీ',
      setCalendarTitle: 'క్యాలెండర్‌ను సెట్ చేయండి',
      setCalendarSubtitle: 'ఒక-క్లిక్ రిమైండర్‌లను సృష్టించడానికి "క్యాలెండర్‌కు జోడించు" బటన్‌లను ఉపయోగించండి.',
      rawLabel: 'ముడి:',
      addToCalendar: 'క్యాలెండర్‌కు జోడించు',
      dateFormatError: 'తేదీ ఫార్మాట్ గుర్తించబడలేదు'
    },
    mr: {
      title: 'मुख्य अटी (आर्थिक, सूचना, दंड)',
      subtitle: 'तुमच्या दस्तऐवजात ओळखलेले विशिष्ट आर्थिक आणि जोखमीचे मूल्य',
      translationNotice: 'संदर्भ मजकूर उतारे अचूकतेसाठी मूळ दस्तऐवजाच्या भाषेत दर्शविले आहेत.',
      referenceLabel: 'संदर्भ (मूळ भाषा):',
      financialTerms: 'आर्थिक अटी',
      importantDates: 'महत्वाच्या तारखा',
      noticePeriods: 'नोटीस कालावधी आणि अंतिम मुदती',
      penalties: 'दंड आणि परिणाम',
      found: 'सापडले',
      highRisk: 'उच्च धोका',
      mediumRisk: 'मध्यम धोका',
      lowRisk: 'कमी धोका',
      emptyState: 'या दस्तऐवजातून कोणतेही विशिष्ट मुख्य अटी आपोआप काढता आल्या नाहीत.',
      emptyStateSubtitle: 'संपूर्ण दस्तऐवज सारांशाचे पुनरावलोकन करा आणि विशिष्ट प्रश्न विचारण्यासाठी चॅट वैशिष्ट्य वापरा.',
      note: 'टीप:',
      importantDateType: 'महत्वाची तारीख',
      startDateType: 'प्रारंभ तारीख',
      endDateType: 'समाप्ती तारीख',
      dueDateType: 'देय तारीख',
      updateDateType: 'अद्ययावत तारीख',
      setCalendarTitle: 'कॅलेंडर सेट करा',
      setCalendarSubtitle: 'एक-क्लिक रिमाइंडर तयार करण्यासाठी "कॅलेंडरमध्ये जोडा" बटणे वापरा.',
      rawLabel: 'मूळ:',
      addToCalendar: 'कॅलेंडरमध्ये जोडा',
      dateFormatError: 'तारीख स्वरूप ओळखले नाही'
    },
    ta: {
      title: 'முக்கிய விதிமுறைகள் (நிதி, அறிவிப்புகள், அபராதங்கள்)',
      subtitle: 'உங்கள் ஆவணத்தில் அடையாளம் காணப்பட்ட குறிப்பிட்ட நிதி மற்றும் இடர் மதிப்புகள்',
      translationNotice: 'குறிப்பு உரைச் சுருக்கங்கள் துல்லியத்திற்காக அசல் ஆவண மொழியில் காட்டப்பட்டுள்ளன.',
      referenceLabel: 'குறிப்பு (அசல் மொழி):',
      financialTerms: 'நிதி விதிமுறைகள்',
      importantDates: 'முக்கியமான தேதிகள்',
      noticePeriods: 'அறிவிப்பு காலங்கள் & காலக்கெடு',
      penalties: 'அபராதங்கள் & விளைவுகள்',
      found: 'கண்டறியப்பட்டது',
      highRisk: 'அதிக ஆபத்து',
      mediumRisk: 'நடுத்தர ஆபத்து',
      lowRisk: 'குறைந்த ஆபத்து',
      emptyState: 'இந்த ஆவணத்தில் இருந்து குறிப்பிட்ட முக்கிய விதிமுறைகள் தானாகவே பிரித்தெடுக்க முடியவில்லை.',
      emptyStateSubtitle: 'முழு ஆவணச் சுருக்கத்தை மதிப்பாய்வு செய்து, குறிப்பிட்ட கேள்விகளைக் கேட்க அரட்டை அம்சத்தைப் பயன்படுத்தவும்.',
      note: 'குறிப்பு:',
      importantDateType: 'முக்கிய தேதி',
      startDateType: 'தொடக்க தேதி',
      endDateType: 'முடிவு தேதி',
      dueDateType: 'கெடு தேதி',
      updateDateType: 'புதுப்பிப்பு தேதி',
      setCalendarTitle: 'நாட்காட்டியை அமைக்கவும்',
      setCalendarSubtitle: 'ஒரே கிளிக்கில் நினைவூட்டல்களை உருவாக்க "நாட்காட்டியில் சேர்" பொத்தான்களைப் பயன்படுத்தவும்.',
      rawLabel: 'மூலம்:',
      addToCalendar: 'நாட்காட்டியில் சேர்',
      dateFormatError: 'தேதி வடிவம் அங்கீகரிக்கப்படவில்லை'
    },
    ur: {
      title: 'کلیدی شرائط (مالیاتی، نوٹس، جرمانے)',
      subtitle: 'آپ کے دستاویز میں شناخت شدہ مخصوص مالیاتی اور خطرے کی اقدار',
      translationNotice: 'حوالہ جات کے متن کے اقتباسات درستگی کے لیے اصل دستاویز کی زبان میں دکھائے گئے ہیں۔',
      referenceLabel: 'حوالہ (اصل زبان):',
      financialTerms: 'مالیاتی شرائط',
      importantDates: 'اہم تاریخیں',
      noticePeriods: 'نوٹس کی مدت اور ڈیڈ لائن',
      penalties: 'جرمانے اور نتائج',
      found: 'مل گئے',
      highRisk: 'زیادہ خطرہ',
      mediumRisk: 'متوسط خطرہ',
      lowRisk: 'کم خطرہ',
      emptyState: 'اس دستاویز سے کوئی مخصوص کلیدی شرائط خود بخود نہیں نکالی جا سکیں۔',
      emptyStateSubtitle: 'مکمل دستاویز کا خلاصہ دیکھیں اور مخصوص سوالات پوچھنے کے لیے چیٹ کی خصوصیت استعمال کریں۔',
      note: 'نوٹ:',
      importantDateType: 'اہم تاریخ',
      startDateType: 'آغاز کی تاریخ',
      endDateType: 'اختتام کی تاریخ',
      dueDateType: 'واجب الادا تاریخ',
      updateDateType: 'تازہ کاری کی تاریخ',
      setCalendarTitle: 'کیلنڈر سیٹ کریں',
      setCalendarSubtitle: 'ایک کلک ریمائنڈر بنانے کے لیے "کیلنڈر میں شامل کریں" بٹن استعمال کریں۔',
      rawLabel: 'خام:',
      addToCalendar: 'کیلنڈر میں شامل کریں',
      dateFormatError: 'تاریخ کی شکل پہچانی نہیں گئی'
    },
    gu: {
      title: 'મુખ્ય શરતો (નાણાકીય, નોટિસ, દંડ)',
      subtitle: 'તમારા દસ્તાવેજમાં ઓળખાયેલ ચોક્કસ નાણાકીય અને જોખમ મૂલ્યો',
      translationNotice: 'ચોકસાઈ માટે સંદર્ભ ટેક્સ્ટના અંશો મૂળ દસ્તાવેજની ભાષામાં બતાવવામાં આવ્યા છે.',
      referenceLabel: 'સંદર્ભ (મૂળ ભાષા):',
      financialTerms: 'નાણાકીય શરતો',
      importantDates: 'મહત્વપૂર્ણ તારીખો',
      noticePeriods: 'નોટિસ અવધિ અને સમયરેખાઓ',
      penalties: 'દંડ અને પરિણામો',
      found: 'મળેલ',
      highRisk: 'ઉચ્ચ જોખમ',
      mediumRisk: 'મધ્યમ જોખમ',
      lowRisk: 'ઓછું જોખમ',
      emptyState: 'આ દસ્તાવેજમાંથી કોઈ ચોક્કસ મુખ્ય શરતો આપમેળે કાઢી શકાઈ નથી.',
      emptyStateSubtitle: 'સંપૂર્ણ દસ્તાવેજ સારાંશની સમીક્ષા કરો અને ચોક્કસ પ્રશ્નો પૂછવા માટે ચેટ સુવિધાનો ઉપયોગ કરો.',
      note: 'નોંધ:',
      importantDateType: 'મહત્વપૂર્ણ તારીખ',
      startDateType: 'પ્રારંભ તારીખ',
      endDateType: 'સમાપ્તિ તારીખ',
      dueDateType: 'નિયત તારીખ',
      updateDateType: 'અપડેટ તારીખ',
      setCalendarTitle: 'કેલેન્ડર સેટ કરો',
      setCalendarSubtitle: 'એક-ક્લિક રિમાઇન્ડર બનાવવા માટે "કેલેન્ડરમાં ઉમેરો" બટનોનો ઉપયોગ કરો.',
      rawLabel: 'કાચું:',
      addToCalendar: 'કેલેન્ડરમાં ઉમેરો',
      dateFormatError: 'તારીખનું ફોર્મેટ ઓળખાયું નથી'
    },
    kn: {
      title: 'ಪ್ರಮುಖ ನಿಯಮಗಳು (ಹಣಕಾಸು, ಸೂಚನೆಗಳು, ದಂಡಗಳು)',
      subtitle: 'ನಿಮ್ಮ ಡಾಕ್ಯುಮೆಂಟ್‌ನಲ್ಲಿ ಗುರುತಿಸಲಾದ ನಿರ್ದಿಷ್ಟ ಹಣಕಾಸು ಮತ್ತು ಅಪಾಯದ ಮೌಲ್ಯಗಳು',
      translationNotice: 'ನಿಖರತೆಗಾಗಿ ಉಲ್ಲೇಖ ಪಠ್ಯದ ಭಾಗಗಳನ್ನು ಮೂಲ ಡಾಕ್ಯುಮೆಂಟ್ ಭಾಷೆಯಲ್ಲಿ ತೋರಿಸಲಾಗುತ್ತದೆ.',
      referenceLabel: 'ಉಲ್ಲೇಖ (ಮೂಲ ಭಾಷೆ):',
      financialTerms: 'ಹಣಕಾಸು ನಿಯಮಗಳು',
      importantDates: 'ಪ್ರಮುಖ ದಿನಾಂಕಗಳು',
      noticePeriods: 'ಸೂಚನೆ ಅವಧಿಗಳು ಮತ್ತು ಗಡುವುಗಳು',
      penalties: 'ದಂಡಗಳು ಮತ್ತು ಪರಿಣಾಮಗಳು',
      found: 'ಕಂಡುಬಂದಿದೆ',
      highRisk: 'ಹೆಚ್ಚಿನ ಅಪಾಯ',
      mediumRisk: 'ಮಧ್ಯಮ ಅಪಾಯ',
      lowRisk: 'ಕಡಿಮೆ ಅಪಾಯ',
      emptyState: 'ಈ ಡಾಕ್ಯುಮೆಂಟ್‌ನಿಂದ ಯಾವುದೇ ನಿರ್ದಿಷ್ಟ ಪ್ರಮುಖ ನಿಯಮಗಳನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಹೊರತೆಗೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.',
      emptyStateSubtitle: 'ಪೂರ್ಣ ಡಾಕ್ಯುಮೆಂಟ್ ಸಾರಾಂಶವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ನಿರ್ದಿಷ್ಟ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಲು ಚಾಟ್ ವೈಶಿಷ್ಟ್ಯವನ್ನು ಬಳಸಿ.',
      note: 'ಗಮನಿಸಿ:',
      importantDateType: 'ಪ್ರಮುಖ ದಿನಾಂಕ',
      startDateType: 'ಪ್ರಾರಂಭ ದಿನಾಂಕ',
      endDateType: 'ಮುಕ್ತಾಯ ದಿನಾಂಕ',
      dueDateType: 'ಗಡುವು ದಿನಾಂಕ',
      updateDateType: 'ನವೀಕರಣ ದಿನಾಂಕ',
      setCalendarTitle: 'ಕ್ಯಾಲೆಂಡರ್ ಹೊಂದಿಸಿ',
      setCalendarSubtitle: 'ಒಂದು-ಕ್ಲಿಕ್ ಜ್ಞಾಪನೆಗಳನ್ನು ರಚಿಸಲು "ಕ್ಯಾಲೆಂಡರ್‌ಗೆ ಸೇರಿಸು" ಬಟನ್‌ಗಳನ್ನು ಬಳಸಿ.',
      rawLabel: 'ಕಚ್ಚಾ:',
      addToCalendar: 'ಕ್ಯಾಲೆಂಡರ್‌ಗೆ ಸೇರಿಸು',
      dateFormatError: 'ದಿನಾಂಕ ಸ್ವರೂಪವನ್ನು ಗುರುತಿಸಲಾಗಿಲ್ಲ'
    },
    ml: {
      title: 'പ്രധാന നിബന്ധനകൾ (സാമ്പത്തിക, അറിയിപ്പുകൾ, പിഴകൾ)',
      subtitle: 'നിങ്ങളുടെ ഡോക്യുമെന്റിൽ തിരിച്ചറിഞ്ഞ പ്രത്യേക സാമ്പത്തിക, റിസ്ക് മൂല്യങ്ങൾ',
      translationNotice: 'കൃത്യതയ്ക്കായി റഫറൻസ് ടെക്സ്റ്റ് ഭാഗങ്ങൾ യഥാർത്ഥ ഡോക്യുമെന്റ് ഭാഷയിൽ കാണിച്ചിരിക്കുന്നു.',
      referenceLabel: 'റഫറൻസ് (യഥാർത്ഥ ഭാഷ):',
      financialTerms: 'സാമ്പത്തിക നിബന്ധനകൾ',
      importantDates: 'പ്രധാന തീയതികൾ',
      noticePeriods: 'നോട്ടീസ് കാലയളവുകളും സമയപരിധികളും',
      penalties: 'പിഴകളും പ്രത്യാഘാതങ്ങളും',
      found: 'കണ്ടെത്തി',
      highRisk: 'ഉയർന്ന റിസ്ക്',
      mediumRisk: 'ഇടത്തരം റിസ്ക്',
      lowRisk: 'കുറഞ്ഞ റിസ്ക്',
      emptyState: 'ഈ ഡോക്യുമെന്റിൽ നിന്ന് പ്രത്യേക പ്രധാന നിബന്ധനകളൊന്നും സ്വയമേവ വേർതിരിച്ചെടുക്കാൻ കഴിഞ്ഞില്ല.',
      emptyStateSubtitle: 'മുഴുവൻ ഡോക്യുമെന്റ് സംഗ്രഹവും അവലോകനം ചെയ്യുക, നിർദ്ദിഷ്ട ചോദ്യങ്ങൾ ചോദിക്കാൻ ചാറ്റ് ഫീച്ചർ ഉപയോഗിക്കുക.',
      note: 'ശ്രദ്ധിക്കുക:',
      importantDateType: 'പ്രധാന തീയതി',
      startDateType: 'ആരംഭ തീയതി',
      endDateType: 'അവസാന തീയതി',
      dueDateType: 'അടയ്‌ക്കേണ്ട തീയതി',
      updateDateType: 'അപ്‌ഡേറ്റ് തീയതി',
      setCalendarTitle: 'കലണ്ടർ സജ്ജമാക്കുക',
      setCalendarSubtitle: 'ഒരു ക്ലിക്കിൽ ഓർമ്മപ്പെടുത്തലുകൾ സൃഷ്ടിക്കാൻ "കലണ്ടറിലേക്ക് ചേർക്കുക" ബട്ടണുകൾ ഉപയോഗിക്കുക.',
      rawLabel: 'അസംസ്കൃതം:',
      addToCalendar: 'കലണ്ടറിലേക്ക് ചേർക്കുക',
      dateFormatError: 'തീയതി ഫോർമാറ്റ് തിരിച്ചറിഞ്ഞില്ല'
    },
    pa: {
      title: 'ਮੁੱਖ ਸ਼ਰਤਾਂ (ਵਿੱਤੀ, ਨੋਟਿਸ, ਜੁਰਮਾਨੇ)',
      subtitle: 'ਤੁਹਾਡੇ ਦਸਤਾਵੇਜ਼ ਵਿੱਚ ਪਛਾਣੇ ਗਏ ਖਾਸ ਵਿੱਤੀ ਅਤੇ ਜੋਖਮ ਮੁੱਲ',
      translationNotice: 'ਸੰਦਰਭ ਪਾਠ ਦੇ ਅੰਸ਼ ਸ਼ੁੱਧਤਾ ਲਈ ਮੂਲ ਦਸਤਾਵੇਜ਼ ਦੀ ਭਾਸ਼ਾ ਵਿੱਚ ਦਿਖਾਏ ਗਏ ਹਨ।',
      referenceLabel: 'ਸੰਦਰਭ (ਮੂਲ ਭਾਸ਼ਾ):',
      financialTerms: 'ਵਿੱਤੀ ਸ਼ਰਤਾਂ',
      importantDates: 'ਮਹੱਤਵਪੂਰਨ ਮਿਤੀਆਂ',
      noticePeriods: 'ਨੋਟਿਸ ਦੀ ਮਿਆਦ ਅਤੇ ਅੰਤਮ ਤਾਰੀਖਾਂ',
      penalties: 'ਜੁਰਮਾਨੇ ਅਤੇ ਨਤੀਜੇ',
      found: 'ਮਿਲੇ',
      highRisk: 'ਉੱਚ ਜੋਖਮ',
      mediumRisk: 'ਮੱਧਮ ਜੋਖਮ',
      lowRisk: 'ਘੱਟ ਜੋਖਮ',
      emptyState: 'ਇਸ ਦਸਤਾਵੇਜ਼ ਵਿੱਚੋਂ ਕੋਈ ਖਾਸ ਮੁੱਖ ਸ਼ਰਤਾਂ ਸਵੈਚਾਲਿਤ ਤੌਰ \'ਤੇ ਨਹੀਂ ਕੱਢੀਆਂ ਜਾ ਸਕੀਆਂ।',
      emptyStateSubtitle: 'ਪੂਰੇ ਦਸਤਾਵੇਜ਼ ਦੇ ਸਾਰ ਦੀ ਸਮੀਖਿਆ ਕਰੋ ਅਤੇ ਖਾਸ ਸਵਾਲ ਪੁੱਛਣ ਲਈ ਚੈਟ ਵਿਸ਼ੇਸ਼ਤਾ ਦੀ ਵਰਤੋਂ ਕਰੋ।',
      note: 'ਨੋਟ:',
      importantDateType: 'ਮਹੱਤਵਪੂਰਨ ਮਿਤੀ',
      startDateType: 'ਸ਼ੁਰੂਆਤੀ ਮਿਤੀ',
      endDateType: 'ਸਮਾਪਤੀ ਮਿਤੀ',
      dueDateType: 'ਨਿਯਤ ਮਿਤੀ',
      updateDateType: 'ਅਪਡੇਟ ਮਿਤੀ',
      setCalendarTitle: 'ਕੈਲੰਡਰ ਸੈੱਟ ਕਰੋ',
      setCalendarSubtitle: 'ਇੱਕ-ਕਲਿੱਕ ਰੀਮਾਈਂਡਰ ਬਣਾਉਣ ਲਈ "ਕੈਲੰਡਰ ਵਿੱਚ ਸ਼ਾਮਲ ਕਰੋ" ਬਟਨਾਂ ਦੀ ਵਰਤੋਂ ਕਰੋ।',
      rawLabel: 'ਕੱਚਾ:',
      addToCalendar: 'ਕੈਲੰਡਰ ਵਿੱਚ ਸ਼ਾਮਲ ਕਰੋ',
      dateFormatError: 'ਮਿਤੀ ਫਾਰਮੈਟ ਪਛਾਣਿਆ ਨਹੀਂ ਗਿਆ'
    },
    or: {
      title: 'ମୁଖ୍ୟ ସର୍ତ୍ତାବଳୀ (ଆର୍ଥିକ, ନୋଟିସ୍, ଜରିମାନା)',
      subtitle: 'ଆପଣଙ୍କ ଦଲିଲରେ ଚିହ୍ନିତ ନିର୍ଦ୍ଦିଷ୍ଟ ଆର୍ଥିକ ଏବଂ ବିପଦ ମୂଲ୍ୟ',
      translationNotice: 'ସଠିକ୍ତା ପାଇଁ ସନ୍ଦର୍ଭ ପାଠ୍ୟ ଅଂଶଗୁଡ଼ିକ ମୂଳ ଦଲିଲ ଭାଷାରେ ଦର୍ଶାଯାଇଛି।',
      referenceLabel: 'ସନ୍ଦର୍ଭ (ମୂଳ ଭାଷା):',
      financialTerms: 'ଆର୍ଥିକ ସର୍ତ୍ତାବଳୀ',
      importantDates: 'ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ତାରିଖଗୁଡ଼ିକ',
      noticePeriods: 'ନୋଟିସ୍ ଅବଧି ଏବଂ ସମୟସୀମା',
      penalties: 'ଜରିମାନା ଏବଂ ପରିଣାମ',
      found: 'ମିଳିଲା',
      highRisk: 'ଉଚ୍ଚ ବିପଦ',
      mediumRisk: 'ମଧ୍ୟମ ବିପଦ',
      lowRisk: 'କମ୍ ବିପଦ',
      emptyState: 'ଏହି ଦଲିଲରୁ କୌଣସି ନିର୍ଦ୍ଦିଷ୍ଟ ମୁଖ୍ୟ ସର୍ତ୍ତାବଳୀ ସ୍ୱୟଂଚାଳିତ ଭାବରେ ବାହାର କରାଯାଇ ପାରିଲା ନାହିଁ।',
      emptyStateSubtitle: 'ସମ୍ପୂର୍ଣ୍ଣ ଦଲିଲ ସାରାଂଶ ସମୀକ୍ଷା କରନ୍ତୁ ଏବଂ ନିର୍ଦ୍ଦିଷ୍ଟ ପ୍ରଶ୍ନ ପଚାରିବା ପାଇଁ ଚାଟ୍ ବୈଶିଷ୍ଟ୍ୟ ବ୍ୟବହାର କରନ୍ତୁ।',
      note: 'ନୋଟ୍:',
      importantDateType: 'ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ତାରିଖ',
      startDateType: 'ଆରମ୍ଭ ତାରିଖ',
      endDateType: 'ଶେଷ ତାରିଖ',
      dueDateType: 'ଦେୟ ତାରିଖ',
      updateDateType: 'ଅଦ୍ୟତନ ତାରିଖ',
      setCalendarTitle: 'କ୍ୟାଲେଣ୍ଡର ସେଟ୍ କରନ୍ତୁ',
      setCalendarSubtitle: 'ଏକ-କ୍ଲିକ୍ ସ୍ମାରକପତ୍ର ସୃଷ୍ଟି କରିବାକୁ "କ୍ୟାଲେଣ୍ଡରରେ ଯୋଡ଼ନ୍ତୁ" ବଟନ୍ ବ୍ୟବହାର କରନ୍ତୁ।',
      rawLabel: 'ମୂଳ:',
      addToCalendar: 'କ୍ୟାଲେଣ୍ଡରରେ ଯୋଡ଼ନ୍ତୁ',
      dateFormatError: 'ତାରିଖ ଫର୍ମାଟ୍ ଚିହ୍ନିତ ହୋଇନାହିଁ'
    },
  };

  const t = translations[language] || translations.en;

  const fullText = documentData.originalText || '';

  // Call the exported functions locally to get data for rendering this panel
  const financialTerms = extractFinancialTerms(fullText, language);
  const penalties = extractPenalties(fullText, language);
  const noticePeriods = extractNoticePeriods(fullText, language);
  const dateTerms = extractDateTerms(fullText, language, translations);
  const dateTermsCount = dateTerms.length;

  const SectionHeader = ({ icon: Icon, title, count, section, color }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 transition-colors rounded-lg"
    >
      <div className="flex items-center space-x-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <h4 className="font-semibold text-white">{title}</h4>
        <span className="text-sm text-gray-400">({count} {t.found})</span>
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="h-5 w-5 text-gray-400" />
      ) : (
        <ChevronDown className="h-5 w-5 text-gray-400" />
      )}
    </button>
  );

  // NEW: Render function for the dates section (pulled from ActionChecklist logic)
  const renderDateSection = () => {
    // We must check if the date utility functions are available before rendering the dates section
    if (typeof formatTermDate === 'undefined' || typeof createGoogleCalendarUrl === 'undefined' || dateTerms.length === 0) {
      return null;
    }

    return (
      <div className="space-y-4">
        {/* Calendar Tip Section (From ActionChecklist logic) */}
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 flex-shrink-0">
          <div className="flex items-start space-x-2">
            <Bell className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-200 font-medium">{t.setCalendarTitle}</p>
              <p className="text-yellow-300 text-sm mt-1">{t.setCalendarSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Extracted Deadlines & Dates Header */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
          <h3 className="text-white font-semibold mb-3 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-400" />
            {t.importantDates}
          </h3>
          <div className="space-y-3">
            {dateTerms.map((term, index) => {
              const calendarUrl = createGoogleCalendarUrl(
                term.date,
                term.type,
                documentData?.fileName || 'Document Date'
              );

              return (
                <div key={index} className="bg-gray-800 p-3 rounded-lg border-l-4 border-blue-500 flex justify-between items-center space-x-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-300">{term.type}</p>
                    <p className="text-lg font-bold text-white">
                      {formatTermDate(term.date, language)}
                    </p>
                    {/* FIXED: Added Raw label translation */}
                    <p className="text-xs text-gray-400 mt-1">{t.rawLabel} {term.date}</p>
                  </div>

                  {calendarUrl ? (
                    <a
                      href={calendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm flex-shrink-0"
                      title={t.addToCalendar}
                    >
                      <Clock className="h-4 w-4" />
                      {/* FIXED: Added Add to Calendar translation */}
                      <span>{t.addToCalendar}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500 px-3 py-1.5">
                      {t.dateFormatError}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 h-full w-full">
      <div className="border-b border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-white flex items-center">
          <FileText className="h-6 w-6 text-blue-400 mr-2" />
          {t.title}
        </h3>
        <p className="text-gray-300 mt-1">
          {t.subtitle}
        </p>

        {isTranslated && (
          <div className="mt-3 flex items-center bg-blue-900/20 border border-blue-500/30 rounded-lg px-3 py-2">
            <Globe className="h-4 w-4 text-blue-400 mr-2 flex-shrink-0" />
            <p className="text-sm text-blue-200">
              {/* FIXED: Added Note translation */}
              <strong>{t.note}</strong> {t.translationNotice}
            </p>
          </div>
        )}
      </div>

      <div className="p-6 border-b border-gray-700 bg-gray-700/30">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{financialTerms.length}</div>
            <div className="text-sm text-gray-300">{t.financialTerms}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{dateTermsCount}</div>
            <div className="text-sm text-gray-300">{t.importantDates}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">{noticePeriods.length}</div>
            <div className="text-sm text-gray-300">{t.noticePeriods}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{penalties.length}</div>
            <div className="text-sm text-gray-300">{t.penalties}</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* FINANCIAL TERMS */}
        {financialTerms.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              icon={DollarSign}
              title={t.financialTerms}
              count={financialTerms.length}
              section="financial"
              color="text-green-400"
            />

            {expandedSections.financial && (
              <div className="space-y-3 mt-2">
                {financialTerms.map((term, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4 border-l-4 border-green-500">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-2xl font-bold text-green-400">{term.amount}</span>
                        <span className="ml-3 text-sm bg-green-900/30 text-green-300 px-2 py-1 rounded">
                          {term.type}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-300 italic mt-2 bg-gray-800 p-2 rounded border-l-2 border-gray-600">
                      {isTranslated && (
                        <div className="text-xs text-gray-500 mb-1 flex items-center">
                          <FileText className="h-3 w-3 mr-1" />
                          {t.referenceLabel}
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{
                        __html: term.context.replace(/\*\*(.*?)\*\*/g, '<strong class="text-yellow-300 font-semibold">$1</strong>')
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NOTICE PERIODS */}
        {noticePeriods.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              icon={Clock}
              title={t.noticePeriods}
              count={noticePeriods.length}
              section="notices"
              color="text-orange-400"
            />

            {expandedSections.notices && (
              <div className="space-y-3 mt-2">
                {noticePeriods.map((term, index) => (
                  <div key={index} className={`bg-gray-700 rounded-lg p-4 border-l-4 ${term.isGracePeriod ? 'border-green-500' : 'border-orange-500'
                    }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-lg font-bold ${term.isGracePeriod ? 'text-green-400' : 'text-orange-400'
                          }`}>{term.period}</span>
                        <span className={`ml-3 text-sm px-2 py-1 rounded ${term.isGracePeriod
                            ? 'bg-green-900/30 text-green-300'
                            : 'bg-orange-900/30 text-orange-300'
                          }`}>
                          {term.type}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-300 italic mt-2 bg-gray-800 p-2 rounded border-l-2 border-gray-600">
                      {isTranslated && (
                        <div className="text-xs text-gray-500 mb-1 flex items-center">
                          <FileText className="h-3 w-3 mr-1" />
                          {t.referenceLabel}
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{
                        __html: term.context.replace(/\*\*(.*?)\*\*/g, '<strong class="text-yellow-300 font-semibold">$1</strong>')
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PENALTIES */}
        {penalties.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              icon={AlertTriangle}
              title={t.penalties}
              count={penalties.length}
              section="penalties"
              color="text-red-400"
            />

            {expandedSections.penalties && (
              <div className="space-y-3 mt-2">
                {penalties.map((term, index) => (
                  <div key={index} className={`bg-gray-700 rounded-lg p-4 border-l-4 ${term.severity === 'high' ? 'border-red-500' :
                      term.severity === 'medium' ? 'border-orange-500' : 'border-yellow-500'
                    }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-sm font-semibold px-2 py-1 rounded ${term.severity === 'high' ? 'bg-red-900/30 text-red-300' :
                            term.severity === 'medium' ? 'bg-orange-900/30 text-orange-300' :
                              'bg-yellow-900/30 text-yellow-300'
                          }`}>
                          {term.type}
                        </span>
                        {term.amounts.length > 0 && (
                          <span className="ml-2 text-lg font-bold text-red-400">
                            {term.amounts.join(', ')}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${term.severity === 'high' ? 'bg-red-600 text-red-100' :
                          term.severity === 'medium' ? 'bg-orange-600 text-orange-100' :
                            'bg-yellow-600 text-yellow-100'
                        }`}>
                        {term.severity === 'high' ? t.highRisk :
                          t.severity === 'medium' ? t.mediumRisk : t.lowRisk}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300 italic mt-2 bg-gray-800 p-2 rounded border-l-2 border-gray-600">
                      {isTranslated && (
                        <div className="text-xs text-gray-500 mb-1 flex items-center">
                          <FileText className="h-3 w-3 mr-1" />
                          {t.referenceLabel}
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{
                        __html: term.context.replace(/\*\*(.*?)\*\*/g, '<strong class="text-yellow-300 font-semibold">$1</strong>')
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* IMPORTANT DATES (MOVED TO BOTTOM, STACKED FULL WIDTH) */}
        {renderDateSection()}

        {financialTerms.length === 0 && noticePeriods.length === 0 && penalties.length === 0 && dateTerms.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">
              {t.emptyState}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {t.emptyStateSubtitle}
            </p>
          </div>
        )}
      </div>

      {/* Footer Line (at the very end of the component) */}
      <div className="border-t border-gray-700 p-4 text-center">
        <p className="text-sm text-gray-500 flex items-center justify-center space-x-1">
          <span>Made with</span>
          <Heart className="h-4 w-4 text-red-500" />
          <span>using Google Cloud AI</span>
        </p>
      </div>

    </div>
  );
}