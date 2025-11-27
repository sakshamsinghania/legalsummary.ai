// pages/history.js - Enhanced Delete Feature with Better UX
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../lib/authContext';
import { firestoreService } from '../lib/firestoreService';
import UserProfile from '../components/UserProfile';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import {
  Loader,
  FileText,
  Clock,
  Search,
  Filter,
  Globe,
  ArrowLeft,
  Trash2,
  Eye,
  AlertCircle
} from 'lucide-react';

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [currentDocId, setCurrentDocId] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null); // Track which doc is being deleted

  // Modal states
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [deleteDocData, setDeleteDocData] = useState(null); // Store doc data for deletion
  const [alertMessage, setAlertMessage] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load documents and track which document we came from
  useEffect(() => {
    if (user) {
      const fromQuery = router.query.currentDoc;
      if (fromQuery) {
        setCurrentDocId(fromQuery);
      }

      loadDocuments();
    }
  }, [user, router.query]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await firestoreService.getUserDocuments(user.uid, 50);
      console.log('Loaded documents:', docs.length);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation modal
  const handleDeleteDocument = (firestoreDocId, fileName, documentId) => {
    if (!user) return;

    setDeleteDocData({ firestoreDocId, fileName, documentId });
    setShowConfirmDelete(true);
  };

  // Perform the actual deletion
  const confirmDelete = async () => {
    if (!deleteDocData) return;

    const { firestoreDocId, fileName, documentId } = deleteDocData;

    try {
      setDeletingDocId(firestoreDocId); // Show loading state for this specific document

      // Delete the document
      await firestoreService.deleteDocument(user.uid, firestoreDocId);

      // If the deleted document was the currently viewed one, clear localStorage
      if (currentDocId === firestoreDocId) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentDocId');
          localStorage.removeItem('selectedLanguage');
        }
        setCurrentDocId(null);
      }

      // Refresh the list after successful deletion
      await loadDocuments();

      console.log(`✅ Document ${firestoreDocId} deleted successfully`);

      // Show success message
      setAlertMessage(`"${fileName}" has been deleted successfully.`);
      setShowSuccessAlert(true);

    } catch (error) {
      console.error('Failed to delete document:', error);
      setAlertMessage(`Failed to delete "${fileName}". Please try again.`);
      setShowErrorAlert(true);
    } finally {
      setDeletingDocId(null);
      setDeleteDocData(null);
    }
  };

  const handleBackToDashboard = () => {
    if (currentDocId) {
      router.push(`/dashboard?docId=${currentDocId}&returnTo=history`);
    } else {
      router.push('/dashboard');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLanguageName = (code) => {
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
      'or': 'Odia'
    };
    return names[code] || code;
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.fileName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLanguage = filterLanguage === 'all' || doc.detectedLanguage === filterLanguage;
    return matchesSearch && matchesLanguage;
  });

  // Get unique languages
  const uniqueLanguages = [...new Set(documents.map(d => d.detectedLanguage).filter(Boolean))];

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Head>
        <title>Document History - Legal Document Demystifier</title>
      </Head>

      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="text-gray-400 hover:text-white transition-colors"
                title={currentDocId ? "Back to Current Document" : "Back to Dashboard"}
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Document History
                </h1>
                <p className="text-gray-300 mt-1">
                  {documents.length} documents processed
                </p>
              </div>
            </div>

            <UserProfile />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Language Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 appearance-none"
            >
              <option value="all">All Languages</option>
              {uniqueLanguages.map(lang => (
                <option key={lang} value={lang}>
                  {getLanguageName(lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 text-blue-500 animate-spin" />
            <span className="text-gray-400 ml-3">Loading history...</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">
              {searchQuery || filterLanguage !== 'all'
                ? 'No documents found'
                : 'No documents yet'}
            </h3>
            <p className="text-gray-400">
              {searchQuery || filterLanguage !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Upload your first legal document to get started'}
            </p>
            {!searchQuery && filterLanguage === 'all' && (
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Document
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition-all hover:shadow-lg group relative ${deletingDocId === doc.id ? 'opacity-50 pointer-events-none' : ''
                  }`}
              >
                {/* Deleting Overlay */}
                {deletingDocId === doc.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg z-10">
                    <div className="text-center">
                      <Loader className="h-8 w-8 text-red-500 animate-spin mx-auto mb-2" />
                      <p className="text-white text-sm">Deleting...</p>
                    </div>
                  </div>
                )}

                {/* Document Icon and Delete Button */}
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-900/30 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-400" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id, doc.fileName || 'Untitled Document', doc.documentId);
                    }}
                    disabled={deletingDocId === doc.id}
                    className="opacity-100 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400 disabled:opacity-50"
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Document Name */}
                <h3 className="text-white font-medium mb-2 line-clamp-2 break-words">
                  {doc.fileName || 'Untitled Document'}
                </h3>

                {/* Metadata */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-400">
                    <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>{formatDate(doc.uploadedAt)}</span>
                  </div>

                  {doc.detectedLanguage && (
                    <div className="flex items-center text-sm text-gray-400">
                      <Globe className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>{getLanguageName(doc.detectedLanguage)}</span>
                      <span className="ml-2 text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
                        {Math.round((doc.languageConfidence || 0) * 100)}%
                      </span>
                    </div>
                  )}

                  {doc.clauseCount && (
                    <div className="flex items-center text-sm text-gray-400">
                      <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>{doc.clauseCount} clauses analyzed</span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={() => {
                    console.log('Viewing document with Firestore ID:', doc.id);
                    router.push(`/dashboard?docId=${doc.id}&returnTo=history`);
                  }}
                  disabled={deletingDocId === doc.id}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Analysis
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Stats Summary */}
        {!loading && documents.length > 0 && (
          <div className="mt-8 bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{documents.length}</div>
                <div className="text-sm text-gray-400">Total Documents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{uniqueLanguages.length}</div>
                <div className="text-sm text-gray-400">Languages Used</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {documents.reduce((sum, doc) => sum + (doc.clauseCount || 0), 0)}
                </div>
                <div className="text-sm text-gray-400">Total Clauses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">
                  {documents.filter(d => {
                    const date = d.uploadedAt?.toDate?.() || new Date(d.uploadedAt);
                    return date > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                  }).length}
                </div>
                <div className="text-sm text-gray-400">This Week</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={confirmDelete}
        title="Delete Document"
        message={`Are you sure you want to permanently delete "${deleteDocData?.fileName}"?\n\nThis will remove:\n• Document analysis\n• All translations\n• Chat history\n\nThis action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <AlertDialog
        isOpen={showSuccessAlert}
        onClose={() => setShowSuccessAlert(false)}
        type="success"
        title="Success"
        message={alertMessage}
      />

      <AlertDialog
        isOpen={showErrorAlert}
        onClose={() => setShowErrorAlert(false)}
        type="error"
        title="Error"
        message={alertMessage}
      />
    </div>
  );
}