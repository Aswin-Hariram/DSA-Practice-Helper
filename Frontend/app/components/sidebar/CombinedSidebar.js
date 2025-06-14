"use client";

import { useEffect, useState, useCallback } from 'react';
import { FiBook, FiClock, FiRotateCw, FiX, FiAlertCircle, FiSearch } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useSidebar } from '../../context/SidebarContext';

const CombinedSidebar = () => {
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const [view, setView] = useState('recent'); // 'recent' or 'all'
  const [recentTopics, setRecentTopics] = useState([]);
  const [allTopics, setAllTopics] = useState([]);
  const [filteredRecentTopics, setFilteredRecentTopics] = useState([]);
  const [filteredAllTopics, setFilteredAllTopics] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [availableCategories, setAvailableCategories] = useState(new Set());
  const [availableDifficulties, setAvailableDifficulties] = useState(new Set());
  const [isLoading, setIsLoading] = useState({
    recent: true,
    all: true
  });
  const [error, setError] = useState({
    recent: null,
    all: null
  });
  const [currentTheme, setCurrentTheme] = useState('light');

  // Set theme on mount and listen for changes
  useEffect(() => {
    // Initial theme setup
    const initialTheme = localStorage.getItem('theme') || 'light';
    setCurrentTheme(initialTheme);
    
    // Function to update theme when it changes
    const handleThemeChange = (e) => {
      const newTheme = e?.detail?.theme || localStorage.getItem('theme') || 'light';
      setCurrentTheme(newTheme);
    };
    
    // Listen for both custom event and storage events
    window.addEventListener('themeChanged', handleThemeChange);
    window.addEventListener('storage', (e) => {
      if (e.key === 'theme') {
        handleThemeChange({ detail: { theme: e.newValue || 'light' } });
      }
    });
    
    // Check for theme changes every 100ms (fallback)
    let lastTheme = initialTheme;
    const themeCheckInterval = setInterval(() => {
      const currentTheme = localStorage.getItem('theme') || 'light';
      if (currentTheme !== lastTheme) {
        lastTheme = currentTheme;
        setCurrentTheme(currentTheme);
      }
    }, 100);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
      clearInterval(themeCheckInterval);
    };
  }, []);

  // Helper function to fetch with retry and resource management
  const fetchWithRetry = useCallback(async (url, options = {}, retries = 3, backoff = 300) => {
    let controller = null;
    let timeoutId = null;
    
    try {
      // Create new controller and timeout for each attempt
      controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller?.abort(new Error('Request timeout'));
      }, 10000); // 10 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }
      
      const data = await response.json();
      
      // Explicitly clean up
      controller = null;
      timeoutId = null;
      
      return data;
      
    } catch (error) {
      // Clean up resources
      if (timeoutId) clearTimeout(timeoutId);
      controller = null;
      
      // Don't retry for certain status codes
      if (error.status && [400, 401, 403, 404, 429].includes(error.status)) {
        throw error;
      }
      
      // Only retry for network errors or server errors
      if (retries > 0) {
        // Add jitter to prevent thundering herd
        const jitter = Math.floor(Math.random() * 100);
        await new Promise(resolve => setTimeout(resolve, backoff + jitter));
        return fetchWithRetry(url, options, retries - 1, Math.min(backoff * 2, 10000)); // Cap max backoff at 10s
      }
      
      throw error;
    }
  }, []); // Empty dependency array as this function is stable

  // Fetch recent topics
  useEffect(() => {
    if (!isSidebarOpen || view !== 'recent') return;

    let isMounted = true;
    
    const fetchRecentTopics = async () => {
      if (isMounted) {
        setIsLoading(prev => ({ ...prev, recent: true }));
      }
      
      try {
        const result = await fetchWithRetry(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/recent-topics`,
          { cache: 'no-store' }
        );
        
        if (isMounted) {
          if (result && result.success && Array.isArray(result.data)) {
            setRecentTopics(result.data);
            setError(prev => ({ ...prev, recent: null }));
          } else {
            throw new Error('Invalid response format from server');
          }
        }
      } catch (error) {
        console.error('Failed to fetch recent topics:', error);
        if (isMounted) {
          setError(prev => ({
            ...prev,
            recent: 'Failed to load recent topics. Please try again later.'
          }));
          setRecentTopics([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(prev => ({ ...prev, recent: false }));
        }
      }
    };

    fetchRecentTopics();
    
    return () => {
      isMounted = false;
    };
  }, [isSidebarOpen, view, fetchWithRetry]);

  // Fetch all topics
  useEffect(() => {
    if (!isSidebarOpen || view !== 'all') return;
    
    let isMounted = true;

    const fetchAllTopics = async () => {
      if (isMounted) {
        setIsLoading(prev => ({ ...prev, all: true }));
      }
      
      try {
        const result = await fetchWithRetry(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/all-topics`,
          { cache: 'no-store' }
        );
        
        if (isMounted) {
          if (result && result.success && Array.isArray(result.data)) {
            setAllTopics(result.data);
            setFilteredAllTopics(result.data);
            setError(prev => ({ ...prev, all: null }));
          } else {
            throw new Error('Invalid response format from server');
          }
        }
      } catch (error) {
        console.error('Failed to fetch all topics:', error);
        if (isMounted) {
          setError(prev => ({
            ...prev,
            all: 'Failed to load topics. Please try again later.'
          }));
          setAllTopics([]);
          setFilteredAllTopics([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(prev => ({ ...prev, all: false }));
        }
      }
    };

    fetchAllTopics();
    
    return () => {
      isMounted = false;
    };
  }, [isSidebarOpen, view, fetchWithRetry]);

  // Set default categories and extract unique categories/difficulties when data loads
  useEffect(() => {
    // Default categories
    const defaultCategories = new Set([
      'string', 
      'hashmap', 
      'matrix', 
      'interval',
      'binary-search',
      'sort',
      'stack',
      'queue',
      'tree',
      'graph',
      'backtracking',
      'dynamic-programming',

    ]);
    
    // Default difficulties
    const defaultDifficulties = new Set([
      'Easy',
      'Medium',
      'Hard'
    ]);
    
    // Add any categories and difficulties from the topics
    if (allTopics.length > 0) {
      allTopics.forEach(topic => {
        if (topic.category) defaultCategories.add(topic.category);
        if (topic.difficulty) defaultDifficulties.add(topic.difficulty);
      });
    }
    
    setAvailableCategories(defaultCategories);
    setAvailableDifficulties(defaultDifficulties);
  }, [allTopics]);

  // Filter all topics based on search query and filters
  useEffect(() => {
    const filtered = allTopics.filter(topic => {
      const matchesSearch = searchQuery === '' || 
        topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (topic.category && topic.category.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'all' || 
        (topic.category && topic.category.toLowerCase() === categoryFilter.toLowerCase());
      
      const matchesDifficulty = difficultyFilter === 'all' || 
        (topic.difficulty && topic.difficulty.toLowerCase() === difficultyFilter.toLowerCase());
      
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
    
    setFilteredAllTopics(filtered);
  }, [searchQuery, allTopics, categoryFilter, difficultyFilter]);

  // Filter recent topics based on search query and filters
  useEffect(() => {
    const filtered = recentTopics.filter(topic => {
      const matchesSearch = searchQuery === '' || 
        topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (topic.category && topic.category.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'all' || 
        (topic.category && topic.category.toLowerCase() === categoryFilter.toLowerCase());
      
      const matchesDifficulty = difficultyFilter === 'all' || 
        (topic.difficulty && topic.difficulty.toLowerCase() === difficultyFilter.toLowerCase());
      
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
    
    setFilteredRecentTopics(filtered);
  }, [searchQuery, recentTopics, categoryFilter, difficultyFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setDifficultyFilter('all');
  };

  const formatTopicName = (name) => {
    return name
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to get difficulty badge styles
  const getDifficultyStyles = (difficulty) => {
    const baseStyles = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-200';
    
    switch((difficulty || '').toLowerCase()) {
      case 'easy':
        return `${baseStyles} ${
          currentTheme === 'dark'
            ? 'bg-green-900/30 text-green-300 border-green-800/50'
            : 'bg-green-50 text-green-700 border-green-100'
        }`;
      case 'medium':
        return `${baseStyles} ${
          currentTheme === 'dark'
            ? 'bg-yellow-900/30 text-yellow-300 border-yellow-800/50'
            : 'bg-yellow-50 text-yellow-700 border-yellow-100'
        }`;
      case 'hard':
        return `${baseStyles} ${
          currentTheme === 'dark'
            ? 'bg-red-900/30 text-red-300 border-red-800/50'
            : 'bg-red-50 text-red-700 border-red-100'
        }`;
      default:
        return `${baseStyles} ${
          currentTheme === 'dark'
            ? 'bg-gray-700/30 text-gray-300 border-gray-600/50'
            : 'bg-gray-50 text-gray-700 border-gray-200'
        }`;
    }
  };

  const handlePractice = async (topicName) => {
    try {
      closeSidebar();
      
      const loadingEvent = new CustomEvent('showLoading', { detail: true });
      window.dispatchEvent(loadingEvent);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/get_dsa_question?topic=${encodeURIComponent(topicName)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch question: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const updateEvent = new CustomEvent('updateProblemData', { 
        detail: {
          title: data.title || topicName,
          description: data.markdown || '',
          solution: data.solution || '',
          testcases: data.testcases || [],
          difficulty: data.difficulty || 'Medium',
          time_complexity: data.time_complexity || 'O(n)',
          space_complexity: data.space_complexity || 'O(1)',
          initial_code: data.initial_code || ''
        }
      });
      window.dispatchEvent(updateEvent);
      
    } catch (error) {
      console.error('Error fetching question:', error);
      const errorEvent = new CustomEvent('showError', { 
        detail: `Failed to load question: ${error.message}`
      });
      window.dispatchEvent(errorEvent);
    } finally {
      const loadingEvent = new CustomEvent('showLoading', { detail: false });
      window.dispatchEvent(loadingEvent);
    }
  };

  if (!isSidebarOpen) return null;

  const currentIsLoading = isLoading[view];
  const currentError = error[view];
  const topicsToShow = view === 'recent' ? filteredRecentTopics : filteredAllTopics;
  const isEmpty = topicsToShow.length === 0;
  const hasActiveFilters = searchQuery !== '' || categoryFilter !== 'all' || difficultyFilter !== 'all';

  return (
    <>
      <div 
        className={`fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-300 ${
          currentTheme === 'dark' ? 'bg-black/70' : 'bg-black/50'
        }`}
        onClick={closeSidebar}
        aria-hidden="true"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={`fixed top-0 right-0 w-full max-w-md h-full shadow-2xl z-50 overflow-y-auto flex flex-col transition-colors duration-300 ${
          currentTheme === 'dark' 
            ? 'bg-gray-900 border-l border-gray-800' 
            : 'bg-white border-l border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`p-6 border-b transition-colors duration-300 ${
          currentTheme === 'dark'
            ? 'bg-gradient-to-r from-gray-800 to-gray-900/80 border-gray-800'
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-gray-100'
        }`}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-4">
                <div className={`p-2.5 rounded-xl shadow-sm ${
                  currentTheme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-50'
                }`}>
                  {view === 'recent' ? (
                    <FiClock className={`w-6 h-6 ${
                      currentTheme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                    }`} />
                  ) : (
                    <FiBook className={`w-6 h-6 ${
                      currentTheme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                    }`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className={`text-2xl font-bold tracking-tight ${
                    currentTheme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {view === 'recent' ? 'Recent Topics' : 'All Topics'}
                  </h2>
                  <p className={`text-sm mt-1.5 ${
                    currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {view === 'recent' 
                  ? 'Your recently practiced topics' 
                  : 'Browse all available topics'}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={closeSidebar}
              className={`ml-4 p-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                currentTheme === 'dark'
                  ? 'hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 focus:ring-offset-gray-900'
                  : 'hover:bg-gray-200/70 text-gray-500 hover:text-gray-700 focus:ring-offset-2'
              }`}
              aria-label="Close sidebar"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* View Toggle */}
          <div className={`mt-4 flex rounded-lg p-1 ${
            currentTheme === 'dark' 
              ? 'bg-gray-800' 
              : 'bg-gray-100'
          }`}>
            <button
              onClick={() => setView('recent')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
                view === 'recent'
                  ? currentTheme === 'dark'
                    ? 'bg-gray-700 shadow text-blue-400 shadow-md shadow-blue-500/10'
                    : 'bg-white shadow text-blue-600 shadow-md shadow-blue-500/20'
                  : currentTheme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setView('all')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
                view === 'all'
                  ? currentTheme === 'dark'
                    ? 'bg-gray-700 shadow text-blue-400 shadow-md shadow-blue-500/10'
                    : 'bg-white shadow text-blue-600 shadow-md shadow-blue-500/20'
                  : currentTheme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
              }`}
            >
              All Topics
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <div className={`relative rounded-lg shadow-sm ${
              currentTheme === 'dark' ? 'bg-gray-800' : 'bg-white'
            }`}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className={currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${view === 'recent' ? 'recent' : 'all'} topics...`}
                className={`block w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors duration-200 ${
                  currentTheme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
          </div>

          {/* Filter Controls */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="category-filter" className={`block text-xs font-medium mb-1 ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Category
              </label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`block w-full pl-3 pr-10 py-2 text-sm rounded-md border focus:ring-blue-500 focus:border-blue-500 ${
                  currentTheme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <option value="all">All Categories</option>
                {Array.from(availableCategories).map((category, index) => (
                  <option key={`cat-${index}`} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="difficulty-filter" className={`block text-xs font-medium mb-1 ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Difficulty
              </label>
              <select
                id="difficulty-filter"
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className={`block w-full pl-3 pr-10 py-2 text-sm rounded-md border focus:ring-blue-500 focus:border-blue-500 ${
                  currentTheme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <option value="all">All Levels</option>
                {Array.from(availableDifficulties).map((difficulty, index) => (
                  <option key={`diff-${index}`} value={difficulty}>
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {searchQuery && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  Search: {searchQuery}
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-200 text-blue-600 hover:bg-blue-300 dark:bg-blue-800/50 dark:text-blue-200 dark:hover:bg-blue-700/70"
                  >
                    <FiX className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {categoryFilter !== 'all' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Category: {categoryFilter}
                  <button 
                    onClick={() => setCategoryFilter('all')}
                    className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-200 text-green-600 hover:bg-green-300 dark:bg-green-800/50 dark:text-green-200 dark:hover:bg-green-700/70"
                  >
                    <FiX className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              {difficultyFilter !== 'all' && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                  {difficultyFilter.charAt(0).toUpperCase() + difficultyFilter.slice(1)}
                  <button 
                    onClick={() => setDifficultyFilter('all')}
                    className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-200 text-purple-600 hover:bg-purple-300 dark:bg-purple-800/50 dark:text-purple-200 dark:hover:bg-purple-700/70"
                  >
                    <FiX className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
              <button 
                onClick={resetFilters}
                className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear all
              </button>
            </div>
          )}
          
          {currentError && (
            <div className={`mt-4 p-3 rounded-lg flex items-start space-x-2.5 ${
              currentTheme === 'dark'
                ? 'bg-red-900/20 border border-red-900/50 text-red-300'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              <FiAlertCircle className="flex-shrink-0 mt-0.5 w-5 h-5" />
              <span className="text-sm">{currentError}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {currentIsLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="relative">
                <FiRotateCw className={`animate-spin w-8 h-8 mb-4 ${
                  currentTheme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                }`} />
                <span className="sr-only">Loading...</span>
              </div>
              <p className={`text-sm font-medium ${
                currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {view === 'recent' ? 'Loading your topics...' : 'Loading topics...'}
              </p>
            </div>
          ) : isEmpty ? (
            <div className="text-center py-12 px-4">
              <div className={`mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-inner border border-dashed ${
                currentTheme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700/50'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                {view === 'recent' ? (
                  <FiClock className={`w-9 h-9 ${
                    currentTheme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                  }`} />
                ) : (
                  <FiBook className={`w-9 h-9 ${
                    currentTheme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                  }`} />
                )}
              </div>
              <h3 className={`text-lg font-semibold mb-1.5 ${
                currentTheme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {view === 'recent' 
                  ? 'No recent topics' 
                  : searchQuery ? 'No matching topics' : 'No topics available'}
              </h3>
              <p className={`text-sm max-w-xs mx-auto ${
                currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {view === 'recent'
                  ? 'Your recently practiced topics will appear here'
                  : searchQuery
                    ? 'Try adjusting your search terms'
                    : 'Check back later for new topics'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topicsToShow.map((topic, index) => (
                <motion.div
                  key={`${view}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: index * 0.03,
                    type: 'spring',
                    stiffness: 300,
                    damping: 20
                  }}
                  className={`group rounded-lg border transition-all duration-200 ${
                    currentTheme === 'dark'
                      ? 'bg-gray-800 border-gray-700 hover:border-blue-700 hover:shadow-lg hover:shadow-blue-900/10'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            currentTheme === 'dark'
                              ? 'bg-blue-900/40 text-blue-300'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {topic.category || 'General'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            currentTheme === 'dark'
                              ? topic.difficulty?.toLowerCase() === 'hard' ? 'bg-red-900/30 text-red-300' :
                                topic.difficulty?.toLowerCase() === 'medium' ? 'bg-yellow-900/30 text-yellow-300' :
                                'bg-green-900/30 text-green-300'
                              : topic.difficulty?.toLowerCase() === 'hard' ? 'bg-red-100 text-red-800' :
                                topic.difficulty?.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                          }`}>
                            {topic.difficulty || 'Easy'}
                          </span>
                        </div>
                        
                        <h3 className={`text-base font-semibold line-clamp-2 mb-1.5 ${
                          currentTheme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {formatTopicName(topic.name)}
                        </h3>
                        
                        {view === 'recent' && topic.last_used && (
                          <p className={`text-xs flex items-center ${
                            currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            <FiClock className="mr-1 w-3 h-3 flex-shrink-0" />
                            {topic.last_used}
                          </p>
                        )}
                      </div>
                      
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium ${
                        currentTheme === 'dark' 
                          ? 'bg-gray-700 text-gray-300' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        className={`w-full flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          currentTheme === 'dark'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          handlePractice(topic.name);
                        }}
                      >
                        {view === 'recent' ? 'Practice' : 'Try Now'}
                        <svg className="ml-1 -mr-0.5 h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H3a1 1 0 110-2h9.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
};

export default CombinedSidebar;
