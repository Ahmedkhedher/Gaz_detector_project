import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  Dimensions, 
  SafeAreaView, 
  TouchableOpacity,
  Platform,
  StatusBar
} from 'react-native';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { database } from './firebaseConfig';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  AlertTriangle, 
  CheckCircle, 
  History, 
  Bell, 
  Settings,
  Wind,
  Sparkles,
  Zap,
  Shield,
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Info
} from 'lucide-react-native';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini Configuration (API Key Rotation)
const GEMINI_API_KEYS = [
  "AIzaSyA_7DTQtmb956Ji1ZdvbQjT-tbk1b1ZAUI",
  "AIzaSyBsX6Lj0YQTH9l7vNqpk2BIELKZ5Os9084",
  "AIzaSyBAdLsY1Gd5wzoAbf0p2NBcoJ8SZNpXb2M",
  "AIzaSyBXdJVsk6OAJdfTlFJ5pnr0b0t_XymfwMY",
  "AIzaSyAQrXYke4ORHRG32Jy_zHUUAsKjL-cGlBc",
  "AIzaSyAyfujTMdUGQmlfwCa01s9OJuR2UxWJByc",
  "AIzaSyAzU2MN6S8m2zn6Zf7cu6oiH0GqUiKwl24",
  "AIzaSyDzfFJEJzcFKs47oXSOyL-JMtobLwYBlEY",
  "AIzaSyBTeu1xb7kHHNUskM4QCYnf9Iv4rPIZNWM",
  "AIzaSyAQrXYke4ORHRG32Jy_zHUUAsKjL-cGlBc",
  "AIzaSyCqLF2wRnefd5GKsvtYuu1E9D_UgKbjPS4"
];

let currentKeyIndex = 0;

const getGeminiModel = () => {
  const apiKey = GEMINI_API_KEYS[currentKeyIndex];
  const genAI = new GoogleGenerativeAI(apiKey);
  // Rotate to next key for the next call
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  // Use gemini-1.5-flash as it has a higher free tier quota and is more stable for general use
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
};

const screenWidth = Dimensions.get('window').width;

export default function App() {
  const [currentGas, setCurrentGas] = useState({ value: 0, percentage: 0, timestamp: 0 });
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('Safe');
  const [expoPushToken, setExpoPushToken] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('Tap "Analyze" for a detailed safety report.');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [safetyScore, setSafetyScore] = useState(100);
  const [aiAssessment, setAiAssessment] = useState('—');
  const [aiAction, setAiAction] = useState('—');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [rawHistory, setRawHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('home');

  const analyzeWithGemini = async () => {
    if (isAnalyzing || currentGas.value === 0) return;
    setIsAnalyzing(true);
    setAiAnalysis('Gemini 2.5 Flash is analyzing your environment...');
    setAiAssessment('—');
    setAiAction('—');
    
    let attempts = 0;
    const maxAttempts = GEMINI_API_KEYS.length;
    let success = false;

    while (attempts < maxAttempts && !success) {
      try {
        const model = getGeminiModel();
        const prompt = `You are an elite IoT safety AI. Analyzing data from an MQ-5 Gas Sensor (LPG, Propane, Methane).
        
        CONTEXT:
        Current Data: Raw=${currentGas.value}, Percentage=${currentGas.percentage.toFixed(2)}%.
        Recent Trend: ${trend.label} at ${ratePerMin}.
        Min/Max (Last 10): ${minLast}% / ${maxLast}%.
        
        Task: 
        1. Safety Score (0-100).
        2. Brief technical assessment including trend analysis.
        3. One critical action.
        
        Format your response strictly as:
        SCORE: [number]
        ASSESSMENT: [max 25 words]
        ACTION: [max 12 words]`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const assessmentMatch = text.match(/ASSESSMENT:\s*(.*)/i);
        const actionMatch = text.match(/ACTION:\s*(.*)/i);
        if (assessmentMatch?.[1]) setAiAssessment(assessmentMatch[1].trim());
        if (actionMatch?.[1]) setAiAction(actionMatch[1].trim());

        // Parse score if possible
        const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
        if (scoreMatch) setSafetyScore(parseInt(scoreMatch[1]));
        
        setAiAnalysis(text
          .replace(/SCORE:\s*\d+/i, '')
          .replace(/ASSESSMENT:\s*/i, 'ASSESSMENT: ')
          .replace(/ACTION:\s*/i, 'ACTION: ')
          .trim());
        success = true;
      } catch (error) {
        attempts++;
        if (error.message.includes("429") || error.message.includes("400")) {
          setAiAnalysis(`Rotating to node ${attempts + 1}...`);
        } else {
          break;
        }
      }
    }

    if (!success) setAiAnalysis("Neural link timeout. Please retry.");
    setIsAnalyzing(false);
  };

  useEffect(() => {
    // Listen to current gas value
    const currentRef = ref(database, 'gas_sensor/current');
    const unsubscribeCurrent = onValue(currentRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCurrentGas(data);
        updateStatus(data.percentage);
      }
    });

    // Listen to history
    const historyRef = query(ref(database, 'gas_sensor/history'), limitToLast(historyLimit));
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rawData = Object.values(data);
        setRawHistory(rawData);
        const historyList = rawData.map(item => item.percentage);
        setHistory(historyList);
      }
    });

    return () => {
      unsubscribeCurrent();
      unsubscribeHistory();
    };
  }, [historyLimit]);

  const updateStatus = (percentage) => {
    if (percentage < 15) setStatus('Safe');
    else if (percentage < 30) setStatus('Warning');
    else setStatus('Danger');
  };

  const getStatusColor = () => {
    switch (status) {
      case 'Safe':
        return '#4ADE80';
      case 'Warning':
        return '#FACC15';
      case 'Danger':
        return '#EF4444';
      default:
        return '#94A3B8';
    }
  };

  const getTrendInfo = () => {
    if (history.length < 2) {
      return { label: 'STABLE', color: '#94A3B8', Icon: Activity };
    }
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const delta = last - prev;
    if (delta > 0.5) return { label: 'RISING', color: '#FACC15', Icon: TrendingUp };
    if (delta < -0.5) return { label: 'FALLING', color: '#4ADE80', Icon: TrendingDown };
    return { label: 'STABLE', color: '#94A3B8', Icon: Activity };
  };

  const trend = getTrendInfo();
  const TrendIcon = trend.Icon;
  const minLast = history.length ? Math.min(...history).toFixed(1) : '—';
  const maxLast = history.length ? Math.max(...history).toFixed(1) : '—';
  const ratePerMin = (() => {
    if (history.length < 2) return '—';
    const last = history[history.length - 1];
    const first = history[0];
    const points = history.length - 1;
    const assumedSecondsPerPoint = 5;
    const minutes = (points * assumedSecondsPerPoint) / 60;
    if (minutes <= 0) return '—';
    const rate = (last - first) / minutes;
    const sign = rate > 0 ? '+' : '';
    return `${sign}${rate.toFixed(1)}%/min`;
  })();

  const quickRecommendation = (() => {
    if (status === 'Danger') return 'Ventilate immediately. Turn off gas source if safe.';
    if (status === 'Warning') return 'Open windows and check nearby appliances.';
    if (trend.label === 'RISING') return 'Reading is rising. Monitor closely and keep ventilation.';
    return 'Air looks stable. Keep monitoring.';
  })();

  const renderContent = () => {
    if (activeTab === 'home') {
      return (
        <View style={{ flex: 1 }}>
          {/* Hero Section - Oversized Reading */}
          <View style={styles.heroSection}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[styles.heroValue, isDarkMode && styles.textWhite]}>
                {currentGas.percentage.toFixed(0).padStart(2, '0')}
              </Text>
              <Text style={[styles.heroUnitInline, isDarkMode && styles.textWhite]}>%</Text>
              <View style={styles.heroMetaInline}>
                <Text style={[styles.heroDate, isDarkMode && styles.textDim]}>
                  {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
              </View>
            </View>
            <View style={styles.heroActionContainer}>
              <View style={[styles.statusTag, { backgroundColor: getStatusColor() + '20' }]}>
                <Text style={[styles.statusTagText, { color: getStatusColor() }]}>{status.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.locationLabel, isDarkMode && styles.textWhite]}>
            ESP32-NODE,{"\n"}MQ5_SENSOR,{"\n"}FIREBASE_RTDB
          </Text>

          <View style={styles.neoGrid}>
            <View style={[styles.gridBlock, isDarkMode && styles.gridBlockDark, { width: (screenWidth - 55) * 0.55 }]}>
              <Text style={[styles.blockLabel, isDarkMode && styles.textDim]}>SAFETY SCORE</Text>
              <Text style={[styles.blockValueLarge, { color: safetyScore > 70 ? '#4ADE80' : safetyScore > 40 ? '#FACC15' : '#EF4444' }]}>
                {safetyScore}
              </Text>
              <View style={styles.syncRow}>
                <Activity size={10} color={isDarkMode ? "#666" : "#999"} />
                <Text style={[styles.blockSub, isDarkMode && styles.textDim, { marginLeft: 4 }]}>
                  SYNCED {new Date(currentGas.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            <View style={[styles.gridBlock, isDarkMode && styles.gridBlockDark, { width: (screenWidth - 55) * 0.45 }]}>
              <Text style={[styles.blockLabel, isDarkMode && styles.textDim]}>SYSTEM STATUS</Text>
              <Text style={[styles.blockValueMedium, isDarkMode && styles.textWhite]}>{status.toUpperCase()}</Text>
              <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.blockSub, isDarkMode && styles.textDim, { marginTop: 10 }]}>
                {trend.label}
              </Text>
            </View>
          </View>

          {/* AI Intelligence Section */}
          <View style={[styles.gridBlock, isDarkMode && styles.gridBlockDark, { minHeight: 160, marginBottom: 15 }]}>
            <View style={styles.blockHeaderRow}>
              <View>
                <Text style={[styles.blockLabel, isDarkMode && styles.textDim]}>AI INTELLIGENCE</Text>
                <Text style={[styles.blockSub, isDarkMode && styles.textDim]}>TREND: {trend.label}</Text>
              </View>
              <TouchableOpacity 
                onPress={analyzeWithGemini}
                disabled={isAnalyzing}
                style={[styles.inlineAnalyzeBtn, isDarkMode && styles.inlineAnalyzeBtnDark]}
              >
                {isAnalyzing ? (
                  <Activity size={16} color={isDarkMode ? "#000" : "#FFF"} />
                ) : (
                  <Sparkles size={16} color={isDarkMode ? "#000" : "#FFF"} />
                )}
              </TouchableOpacity>
            </View>
            
            <View style={styles.aiContentContainer}>
              <View style={[styles.aiBullet, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.aiTextSmall, isDarkMode && styles.textWhite]}>
                {aiAssessment !== '—' ? aiAssessment : aiAnalysis}
              </Text>
            </View>
            
            {aiAction !== '—' && (
              <View style={[styles.aiActionContainer, isDarkMode && styles.aiActionContainerDark]}>
                <Text style={[styles.aiActionText, isDarkMode && styles.textWhite]}>{aiAction}</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    if (activeTab === 'analytics') {
      return (
        <View style={{ flex: 1 }}>
          <Text style={[styles.locationLabel, isDarkMode && styles.textWhite, { marginBottom: 20 }]}>
            DENSITY{"\n"}ANALYTICS
          </Text>

          {/* Smart Insights Grid */}
          <View style={styles.neoGrid}>
            <View style={[styles.gridBlock, isDarkMode && styles.gridBlockDark, { width: (screenWidth - 55) * 0.5 }]}>
              <Text style={[styles.blockLabel, isDarkMode && styles.textDim]}>RAW SENSOR</Text>
              <Text style={[styles.blockValueMedium, isDarkMode && styles.textWhite]}>{currentGas.value}</Text>
              <Text style={[styles.blockSub, isDarkMode && styles.textDim]}>UNITS</Text>
            </View>
            <View style={[styles.gridBlock, isDarkMode && styles.gridBlockDark, { width: (screenWidth - 55) * 0.5 }]}>
              <Text style={[styles.blockLabel, isDarkMode && styles.textDim]}>RATE</Text>
              <Text style={[styles.blockValueMedium, isDarkMode && styles.textWhite]}>{ratePerMin}</Text>
              <Text style={[styles.blockSub, isDarkMode && styles.textDim]}>CHANGE</Text>
            </View>
          </View>

          {/* Chart Section */}
          <View style={[styles.chartContainer, isDarkMode && styles.chartContainerDark]}>
            <View style={styles.blockHeaderRow}>
              <View>
                <Text style={[styles.blockLabel, isDarkMode && styles.textDim]}>HISTORY TIMELINE</Text>
                <View style={styles.filterRow}>
                  {[10, 20, 50].map((limit) => (
                    <TouchableOpacity 
                      key={limit} 
                      onPress={() => setHistoryLimit(limit)}
                      style={[
                        styles.filterBtn, 
                        historyLimit === limit && (isDarkMode ? styles.filterBtnActiveDark : styles.filterBtnActive)
                      ]}
                    >
                      <Text style={[
                        styles.filterText, 
                        historyLimit === limit && (isDarkMode ? styles.textBlack : styles.textWhite)
                      ]}>{limit}P</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.chartLegend}>
                <View style={[styles.legendDot, { backgroundColor: isDarkMode ? '#FFF' : '#000' }]} />
                <Text style={[styles.blockSub, isDarkMode && styles.textDim]}>LPG %</Text>
              </View>
            </View>
            {history.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <LineChart
                  data={{ 
                    labels: [], 
                    datasets: [
                      { data: history },
                      { data: [15], withDots: false, color: () => `rgba(250, 204, 21, 0.2)` },
                      { data: [30], withDots: false, color: () => `rgba(239, 68, 68, 0.2)` }
                    ] 
                  }}
                  width={screenWidth - 40}
                  height={180}
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: isDarkMode ? '#1A1A1A' : '#F0F0F0',
                    backgroundGradientTo: isDarkMode ? '#1A1A1A' : '#F0F0F0',
                    decimalPlaces: 0,
                    color: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
                    propsForDots: { r: '4', strokeWidth: '2', stroke: isDarkMode ? '#000' : '#FFF' },
                    strokeWidth: 3,
                    fillShadowGradient: isDarkMode ? '#FFF' : '#000',
                    fillShadowGradientOpacity: 0.1,
                  }}
                  bezier
                  withInnerLines={true}
                  withOuterLines={false}
                  withHorizontalLabels={true}
                  withVerticalLabels={false}
                  onZero={true}
                  style={{ paddingRight: 0, marginLeft: -20 }}
                  onDataPointClick={({ index, value }) => {
                    const point = rawHistory[index];
                    if (point) {
                      setSelectedPoint({
                        value: value.toFixed(1),
                        time: new Date(point.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        date: new Date(point.timestamp * 1000).toLocaleDateString([], { day: 'numeric', month: 'short' })
                      });
                    }
                  }}
                />
                {selectedPoint && (
                  <TouchableOpacity 
                    style={[styles.tooltipContainer, isDarkMode && styles.tooltipContainerDark]}
                    onPress={() => setSelectedPoint(null)}
                  >
                    <View style={styles.tooltipHeader}>
                      <Text style={styles.tooltipDate}>{selectedPoint.date}</Text>
                      <Text style={styles.tooltipTime}>{selectedPoint.time}</Text>
                    </View>
                    <Text style={[styles.tooltipValue, isDarkMode && styles.textWhite]}>
                      {selectedPoint.value}<Text style={styles.tooltipUnit}>%</Text>
                    </Text>
                    <Text style={styles.tooltipHint}>Tap to dismiss</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.chartStatsRow}>
                  <View style={styles.statMini}>
                    <Text style={styles.statMiniLabel}>AVG</Text>
                    <Text style={[styles.statMiniValue, isDarkMode && styles.textWhite]}>
                      {(history.reduce((a, b) => a + b, 0) / history.length).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.statMini}>
                    <Text style={styles.statMiniLabel}>PEAK</Text>
                    <Text style={[styles.statMiniValue, isDarkMode && styles.textWhite]}>{maxLast}%</Text>
                  </View>
                  <View style={styles.statMini}>
                    <Text style={styles.statMiniLabel}>LOW</Text>
                    <Text style={[styles.statMiniValue, isDarkMode && styles.textWhite]}>{minLast}%</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <Activity size={20} color={isDarkMode ? "#FFF" : "#000"} />
                <Text style={[styles.blockSub, { marginTop: 10 }]}>COLLECTING DATA...</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <StatusBar hidden />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.neoHeader}>
          <View style={styles.neoHeaderLeft}>
            <Activity size={20} color={isDarkMode ? "#FFF" : "#000"} />
            <Text style={[styles.neoTime, isDarkMode && styles.textWhite]}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.neoHeaderRight}>
            <TouchableOpacity 
              onPress={() => setIsDarkMode(!isDarkMode)}
              style={[styles.toggleBtn, isDarkMode && styles.toggleBtnDark]}
            >
              <Text style={[styles.toggleText, isDarkMode && styles.textWhite]}>
                {isDarkMode ? 'LIGHT' : 'DARK'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView 
            contentContainerStyle={styles.neoScroll} 
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {renderContent()}
          </ScrollView>

          {/* Bottom Navigation - Fixed outside ScrollView */}
          <View style={styles.neoNav}>
            <TouchableOpacity 
              onPress={() => setActiveTab('home')}
              style={[activeTab === 'home' ? styles.navItemActive : styles.navItem, isDarkMode && (activeTab === 'home' ? styles.navItemActiveDark : styles.navItemDark)]}
            >
              <Shield size={20} color={activeTab === 'home' ? (isDarkMode ? "#000" : "#FFF") : (isDarkMode ? "#FFF" : "#000")} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setActiveTab('analytics')}
              style={[activeTab === 'analytics' ? styles.navItemActive : styles.navItem, isDarkMode && (activeTab === 'analytics' ? styles.navItemActiveDark : styles.navItemDark)]}
            >
              <Activity size={20} color={activeTab === 'analytics' ? (isDarkMode ? "#000" : "#FFF") : (isDarkMode ? "#FFF" : "#000")} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navItem, isDarkMode && styles.navItemDark]}>
              <Settings size={20} color={isDarkMode ? "#FFF" : "#000"} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  containerDark: { backgroundColor: '#000' },
  textWhite: { color: '#FFF' },
  textDim: { color: '#666' },
  neoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  neoHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  neoTime: { fontSize: 18, fontWeight: '700' },
  toggleBtn: { backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  toggleBtnDark: { backgroundColor: '#333' },
  toggleText: { fontSize: 10, fontWeight: '900' },
  neoScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  heroSection: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  heroActionContainer: { marginTop: 25 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroValue: { fontSize: 120, fontWeight: '900', letterSpacing: -8, lineHeight: 120 },
  heroUnitInline: { fontSize: 36, fontWeight: '900', marginLeft: 5, marginBottom: 15 },
  heroMetaInline: { marginLeft: 12, marginBottom: 20 },
  heroDate: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  locationLabel: { fontSize: 24, fontWeight: '900', lineHeight: 28, marginBottom: 20, letterSpacing: -1 },
  neoGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridBlock: { backgroundColor: '#F0F0F0', borderRadius: 20, padding: 16, minHeight: 120 },
  gridBlockDark: { backgroundColor: '#1A1A1A' },
  blockLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: '#999', marginBottom: 8 },
  blockValueLarge: { fontSize: 36, fontWeight: '900', letterSpacing: -2 },
  blockValueMedium: { fontSize: 20, fontWeight: '900', letterSpacing: -1 },
  blockValueSmall: { fontSize: 12, fontWeight: '900' },
  blockSub: { fontSize: 9, fontWeight: '700', marginTop: 4, color: '#999' },
  syncRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusIndicator: { width: 30, height: 3, borderRadius: 2, marginTop: 12 },
  blockHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  inlineAnalyzeBtn: { 
    backgroundColor: '#000', 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  inlineAnalyzeBtnDark: { backgroundColor: '#FFF' },
  filterRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  filterBtn: { 
    paddingHorizontal: 6, 
    paddingVertical: 3, 
    borderRadius: 5, 
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  filterBtnActive: { backgroundColor: '#000', borderColor: '#000' },
  filterBtnActiveDark: { backgroundColor: '#FFF', borderColor: '#FFF' },
  filterText: { fontSize: 8, fontWeight: '800', color: '#999' },
  textBlack: { color: '#000' },
  neoAnalyzeBtn: { 
    backgroundColor: '#000', 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  neoAnalyzeBtnDark: { backgroundColor: '#FFF' },
  analyzeText: { fontSize: 11, fontWeight: '900' },
  aiContentContainer: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  aiBullet: {
    width: 3,
    height: '100%',
    borderRadius: 2,
  },
  aiTextSmall: { fontSize: 13, fontWeight: '600', lineHeight: 18, flex: 1 },
  aiActionContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  aiActionContainerDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  aiActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
    flex: 1,
  },
  chartContainer: { backgroundColor: '#F0F0F0', borderRadius: 20, padding: 16, marginBottom: 20 },
  chartContainerDark: { backgroundColor: '#1A1A1A' },
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 5, height: 5, borderRadius: 2.5 },
  chartFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  loadingContainer: { height: 100, alignItems: 'center', justifyContent: 'center' },
  chartStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  statMini: { alignItems: 'flex-start' },
  statMiniLabel: { fontSize: 8, fontWeight: '900', color: '#999', letterSpacing: 1 },
  statMiniValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  tooltipContainer: {
    position: 'absolute',
    top: 30,
    right: 0,
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    minWidth: 110,
  },
  tooltipContainerDark: {
    backgroundColor: '#1A1A1A',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    gap: 8,
  },
  tooltipDate: { fontSize: 9, fontWeight: '800', color: '#3B82F6' },
  tooltipTime: { fontSize: 9, fontWeight: '600', color: '#999' },
  tooltipValue: { fontSize: 20, fontWeight: '900' },
  tooltipUnit: { fontSize: 10, color: '#999', marginLeft: 2 },
  tooltipHint: { fontSize: 7, fontWeight: '700', color: '#CCC', marginTop: 3, textAlign: 'center', letterSpacing: 0.5 },
  neoNav: { flexDirection: 'row', justifyContent: 'center', gap: 15, paddingVertical: 10 },
  navItem: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  navItemDark: { backgroundColor: '#1A1A1A' },
  navItemActive: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  navItemActiveDark: { backgroundColor: '#FFF' },
});
