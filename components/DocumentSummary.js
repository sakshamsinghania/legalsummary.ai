// components/DocumentSummary.js

import { FileText, Users, DollarSign, Calendar, AlertTriangle, ShieldCheck, Copy, Download, MessageSquare } from 'lucide-react'; import ReactMarkdown from 'react-markdown';
import { useState } from 'react';

export default function DocumentSummary({ documentData, language = 'en' }) {
  const summary = documentData.summary || '';
  const [showFullText, setShowFullText] = useState(false);

  // ADDED FUNCTIONS
  const handleCopySummary = () => {
    navigator.clipboard.writeText(summary).then(() => {
      alert('Summary copied to clipboard!');
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  };

  const handleDownloadSummary = () => {
    const filename = `${documentData.fileName.replace(/\..+$/, '')}_summary.txt`;
    const text = `Document Summary: ${documentData.fileName}\n\n${summary}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };



  // UI Translation dictionary
  const translations = {
    en: {
      title: 'Document Analysis Summary',
      subtitle: 'A clear breakdown of your document\'s most important terms.'
    },
    hi: {
      title: 'दस्तावेज़ विश्लेषण सारांश',
      subtitle: 'आपके दस्तावेज़ की सबसे महत्वपूर्ण शर्तों का स्पष्ट विवरण।'
    },
    bn: {
      title: 'নথি বিশ্লেষণ সারসংক্ষেপ',
      subtitle: 'আপনার নথির সবচেয়ে গুরুত্বপূর্ণ শর্তাবলীর স্পষ্ট বিবরণ।'
    },
    te: {
      title: 'పత్రం విశ్లేషణ సారాంశం',
      subtitle: 'మీ పత్రం యొక్క అత్యంత ముఖ్యమైన నిబంధనల స్పష్టమైన వివరణ।'
    },
    mr: {
      title: 'दस्तऐवज विश्लेषण सारांश',
      subtitle: 'तुमच्या दस्तऐवजाच्या सर्वात महत्त्वाच्या अटींचे स्पष्ट विवरण।'
    },
    ta: {
      title: 'ஆவண பகுப்பாய்வு சுருக்கம்',
      subtitle: 'உங்கள் ஆவணத்தின் மிக முக்கியமான விதிமுறைகளின் தெளிவான பகுப்பாய்வு।'
    },
    kn: {
      title: 'ಡಾಕ್ಯುಮೆಂಟ್ ವಿಶ್ಲೇಷಣೆ ಸಾರಾಂಶ',
      subtitle: 'ನಿಮ್ಮ ಡಾಕ್ಯುಮೆಂಟ್‌ನ ಅತ್ಯಂತ ಮುಖ್ಯವಾದ ನಿಯಮಗಳ ಸ್ಪಷ್ಟ ವಿವರಣೆ।'
    },
    ml: {
      title: 'ഡോക്യുമെന്റ് വിശകലനം സംഗ്രഹം',
      subtitle: 'നിങ്ങളുടെ ഡോക്യുമെന്റിന്റെ ഏറ്റവും പ്രധാനപ്പെട്ട നിബന്ധനകളുടെ വ്യക്തമായ വിശദീകരണം।'
    },
    gu: {
      title: 'દસ્તાવેજ વિશ્લેષણ સારાંશ',
      subtitle: 'તમારા દસ્તાવેજની સૌથી મહત્વપૂર્ણ શરતોનું સ્પષ્ટ વિવરણ।'
    },
    pa: {
      title: 'ਦਸਤਾਵੇਜ਼ ਵਿਸ਼ਲੇਸ਼ਣ ਸਾਰ',
      subtitle: 'ਤੁਹਾਡੇ ਦਸਤਾਵੇਜ਼ ਦੀਆਂ ਸਭ ਤੋਂ ਮਹੱਤਵਪੂਰਨ ਸ਼ਰਤਾਂ ਦਾ ਸਪੱਸ਼ਟ ਵਿਵਰਣ।'
    },
    or: {
      title: 'ଡକୁମେଣ୍ଟ ବିଶ୍ଳେଷଣ ସାରାଂଶ',
      subtitle: 'ଆପଣଙ୍କ ଡକୁମେଣ୍ଟର ସବୁଠାରୁ ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ସର୍ତ୍ତଗୁଡ଼ିକର ସ୍ପଷ୍ଟ ବିବରଣୀ।'
    },
    ur: {
      title: 'دستاویز تجزیہ خلاصہ',
      subtitle: 'آپ کی دستاویز کی سب سے اہم شرائط کی واضح تفصیل۔'
    },
    es: {
      title: 'Resumen de Análisis del Documento',
      subtitle: 'Un desglose claro de los términos más importantes de su documento.'
    },
    fr: {
      title: 'Résumé d\'Analyse du Document',
      subtitle: 'Une analyse claire des termes les plus importants de votre document.'
    },
    de: {
      title: 'Dokumentanalyse Zusammenfassung',
      subtitle: 'Eine klare Aufschlüsselung der wichtigsten Bedingungen Ihres Dokuments.'
    },
    zh: {
      title: '文档分析摘要',
      subtitle: '清晰展示您文档中最重要的条款。'
    },
    ja: {
      title: '文書分析概要',
      subtitle: 'お客様の文書の最も重要な条項の明確な内訳。'
    }
  };

  const t = translations[language] || translations.en;

  // MODIFIED LOGIC: Extract the non-header introduction (Main Facts) separately
  const sections = summary.split(/\n##\s+/).filter(s => s.trim().length > 0);

  // The first element is the "Main Facts" or introductory content, which we ignore for display
  // const introSectionContent = sections.length > 0 ? sections[0].trim() : '';

  // The remaining sections are the card content (starting with ## Parties Involved)
  const cardSections = sections.slice(1);

  const summarySections = cardSections.map((section, index) => {
    const firstNewline = section.indexOf('\n');
    const title = firstNewline > 0 ? section.substring(0, firstNewline).trim() : section.substring(0, 50).trim();
    const content = firstNewline > 0 ? section.substring(firstNewline + 1).trim() : section.trim();

    // Assign icons based on position, not keywords
    const icons = [Users, DollarSign, ShieldCheck, Calendar, AlertTriangle];
    const colors = ['indigo', 'green', 'blue', 'amber', 'red'];

    return {
      title,
      content,
      icon: icons[index % icons.length],
      color: colors[index % colors.length]
    };
  }).filter(s => s.content.length > 20);


  const colorClasses = {
    indigo: {
      bg: 'bg-indigo-900/20',
      border: 'border-indigo-500/50',
      icon: 'text-indigo-400'
    },
    green: {
      bg: 'bg-green-900/20',
      border: 'border-green-500/50',
      icon: 'text-green-400'
    },
    blue: {
      bg: 'bg-blue-900/20',
      border: 'border-blue-500/50',
      icon: 'text-blue-400'
    },
    amber: {
      bg: 'bg-amber-900/20',
      border: 'border-amber-500/50',
      icon: 'text-amber-400'
    },
    red: {
      bg: 'bg-red-900/20',
      border: 'border-red-500/50',
      icon: 'text-red-400'
    }
  };

  return (


    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center mb-2">
              <FileText className="h-6 w-6 text-blue-400 mr-2" />
              {t.title}
            </h2>
            <p className="text-gray-300">
              {t.subtitle}
            </p>
          </div>
          {/* ADDED BUTTONS */}
          <div className="flex space-x-3 flex-shrink-0">
            <button
              onClick={handleCopySummary}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-white"
              title="Copy Summary"
            >
              <Copy className="h-5 w-5" />
            </button>
            <button
              onClick={handleDownloadSummary}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white"
              title="Download Summary"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
          {/* END ADDED BUTTONS */}
        </div>

        {/* REMOVED rendering of introSectionContent here to skip 'Main Facts' display */}
      </div>

      {/* ADDED FULL TEXT VIEW */}
      {/* {documentData.originalText && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <button 
            onClick={() => setShowFullText(!showFullText)}
            className="w-full flex items-center justify-between text-gray-300 hover:text-white"
          >
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span className="font-medium">
                {showFullText ? 'Hide Full Extracted Text Preview' : 'Show Full Extracted Text Preview'}
              </span>
            </div>
            <span className="text-sm text-gray-500">{documentData.originalText.length.toLocaleString()} characters</span>
          </button>
          
          {showFullText && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg max-h-96 overflow-y-auto text-sm text-gray-400 whitespace-pre-wrap border border-gray-700">
              {documentData.originalText}
            </div>
          )}
        </div>
      )} */}
      {/* END ADDED FULL TEXT VIEW */}



      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {summarySections.length > 0 ? (
          summarySections.map((section, index) => {
            const Icon = section.icon;
            const styles = colorClasses[section.color] || colorClasses.blue;

            return (
              <div key={index} className={`bg-gray-800 rounded-lg border p-6 transition-all hover:shadow-lg hover:-translate-y-1 ${styles.bg} ${styles.border}`}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 rounded-lg bg-gray-700">
                    <Icon className={`h-5 w-5 ${styles.icon}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                </div>
                <div className="prose prose-invert max-w-none text-gray-300 text-sm">
                  <ReactMarkdown>{section.content}</ReactMarkdown>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="prose prose-invert max-w-none text-gray-300">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded text-sm text-blue-200">
              ℹ️ Full document summary shown. Sections could not be automatically categorized.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}