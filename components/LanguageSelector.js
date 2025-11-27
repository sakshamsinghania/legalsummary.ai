import { useState } from 'react';
import { Globe, ChevronDown, Check, Clock, Zap } from 'lucide-react';

// INDIAN LANGUAGES ONLY
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇮🇳', native: 'English' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', flag: '🇮🇳', native: 'বাংলা' },
  { code: 'te', name: 'Telugu', flag: '🇮🇳', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳', native: 'मराठी' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', native: 'தமிழ்' },
  { code: 'ur', name: 'Urdu', flag: '🇮🇳', native: 'اردو' },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', flag: '🇮🇳', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', flag: '🇮🇳', native: 'ଓଡ଼ିଆ' },
];

export default function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  showDetectedLanguage = null,
  availableLanguages = [],
  isTranslating = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedLang = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);

  const handleLanguageSelect = (languageCode) => {
    onLanguageChange(languageCode);
    setIsOpen(false);
    setSearchQuery('');
  };

  const isCached = (langCode) => availableLanguages.includes(langCode);
  const isDetected = (langCode) => langCode === showDetectedLanguage;

  // Filter languages based on search
  const filteredLanguages = SUPPORTED_LANGUAGES.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.native.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDisplayName = (lang) => {
    if (!lang) return 'Select Language';
    if (lang.code === 'en') {
      return lang.name;
    }
    return `${lang.name} (${lang.native})`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isTranslating}
        className="flex items-center space-x-2 px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Globe className="h-4 w-4 text-gray-300" />
        <span className="text-sm font-medium text-gray-100">
          {selectedLang?.flag} {getDisplayName(selectedLang)}
        </span>
        {availableLanguages.length > 1 && (
          <span className="text-xs bg-green-600 text-green-100 px-2 py-0.5 rounded-full">
            {availableLanguages.length}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''
          }`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-20 max-h-[32rem] overflow-hidden flex flex-col">
          {/* Search Box */}
          <div className="p-3 border-b border-gray-600 sticky top-0 bg-gray-700 z-10">
            <input
              type="text"
              placeholder="Search languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="overflow-y-auto">
            {/* Detected Language Section */}
            {showDetectedLanguage && !searchQuery && (
              <>
                <div className="px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wide bg-gray-800/50">
                  Detected Language
                </div>
                {SUPPORTED_LANGUAGES
                  .filter(lang => lang.code === showDetectedLanguage)
                  .map((language) => (
                    <button
                      key={`detected-${language.code}`}
                      onClick={() => handleLanguageSelect(language.code)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-600 transition-colors text-blue-300 bg-blue-900/30"
                    >
                      <span className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <span className="text-lg">{language.flag}</span>
                          <span className="font-medium">{getDisplayName(language)}</span>
                          <span className="text-xs bg-blue-600 text-blue-100 px-2 py-0.5 rounded">
                            ✓ Original
                          </span>
                        </span>
                        {isCached(language.code) && (
                          <Zap className="h-3 w-3 text-green-400" />
                        )}
                      </span>
                    </button>
                  ))}
                <div className="border-t border-gray-600 my-2"></div>
              </>
            )}

            {/* Cached Translations Section */}
            {availableLanguages.length > 1 && !searchQuery && (
              <>
                <div className="px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wide flex items-center justify-between bg-gray-800/50">
                  <span>Cached Translations</span>
                  <span className="bg-green-900/50 text-green-300 px-2 py-0.5 rounded text-xs">
                    Instant
                  </span>
                </div>
                {SUPPORTED_LANGUAGES
                  .filter(lang => isCached(lang.code) && lang.code !== showDetectedLanguage)
                  .map((language) => (
                    <button
                      key={`cached-${language.code}`}
                      onClick={() => handleLanguageSelect(language.code)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-600 transition-colors ${language.code === selectedLanguage
                          ? 'bg-green-900/30 text-green-200'
                          : 'text-gray-200'
                        }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <span className="text-lg">{language.flag}</span>
                          <span className="font-medium">{getDisplayName(language)}</span>
                          <Zap className="h-3 w-3 text-green-400" />
                        </span>
                        {language.code === selectedLanguage && (
                          <Check className="h-4 w-4 text-green-400" />
                        )}
                      </span>
                    </button>
                  ))}
                <div className="border-t border-gray-600 my-2"></div>
              </>
            )}

            {/* All Indian Languages */}
            <div className="px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wide bg-gray-800/50">
              Indian Languages
            </div>
            {filteredLanguages
              .filter(lang => !isCached(lang.code) && !isDetected(lang.code))
              .map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageSelect(language.code)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-600 transition-colors ${language.code === selectedLanguage
                      ? 'bg-blue-900/50 text-blue-200'
                      : 'text-gray-200'
                    }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <span className="text-lg">{language.flag}</span>
                      <span className="font-medium">{getDisplayName(language)}</span>
                      <Clock className="h-3 w-3 text-gray-500" />
                    </span>
                    {language.code === selectedLanguage && (
                      <Check className="h-4 w-4 text-blue-400" />
                    )}
                  </span>
                </button>
              ))}
          </div>

          {/* Legend */}
          <div className="border-t border-gray-600 px-4 py-3 bg-gray-800/50 sticky bottom-0">
            <div className="text-xs text-gray-400 space-y-1.5">
              <div className="flex items-center space-x-2">
                <Zap className="h-3 w-3 text-green-400" />
                <span>Cached - instant switching</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-3 w-3 text-gray-500" />
                <span>Will translate (~30 seconds)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}