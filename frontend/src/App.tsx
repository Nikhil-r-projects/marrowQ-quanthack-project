import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';
import { OverviewView } from './views/OverviewView';
import { DatasetView } from './views/DatasetView';
import { SetupView } from './views/SetupView';
import { MonitorView } from './views/MonitorView';
import { ResultsView } from './views/ResultsView';
import { PredictionView } from './views/PredictionView';
import { ReportView } from './views/ReportView';
import { DatasetProfile, Experiment, SystemHealth } from './types';
import { fetchHealth, fetchDemoDataset, fetchExperimentsList, fetchExperiment } from './api';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [dataset, setDataset] = useState<DatasetProfile | null>(null);
  const [currentExperiment, setCurrentExperiment] = useState<Experiment | null>(null);
  const [latestExperiment, setLatestExperiment] = useState<Experiment | null>(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err) => console.error('Health fetch error', err));

    // Load recent experiments if any
    fetchExperimentsList()
      .then((exps) => {
        if (exps && exps.length > 0) {
          const latestId = exps[0].experiment_id;
          fetchExperiment(latestId)
            .then((fullExp) => {
              setLatestExperiment(fullExp);
              if (!currentExperiment) {
                setCurrentExperiment(fullExp);
              }
            })
            .catch((e) => console.error('Failed to load latest experiment', e));
        }
      })
      .catch((e) => console.error('Failed to list experiments', e));
  }, []);

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    try {
      const demo = await fetchDemoDataset();
      setDataset(demo);
    } catch (err) {
      console.error('Failed to load demo', err);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleExperimentStarted = (exp: Experiment) => {
    setCurrentExperiment(exp);
    setActiveTab('monitor');
  };

  const handleExperimentUpdated = (exp: Experiment) => {
    setCurrentExperiment(exp);
    if (exp.status === 'completed') {
      setLatestExperiment(exp);
    }
  };

  const isExperimentRunning = currentExperiment?.status === 'running' || currentExperiment?.status === 'created';

  return (
    <div className="app-container">
      <Header health={health} dataset={dataset} />
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasDataset={!!dataset}
        hasExperiment={!!latestExperiment}
        isExperimentRunning={!!isExperimentRunning}
      />

      <main className="main-content">
        {activeTab === 'overview' && (
          <OverviewView
            dataset={dataset}
            latestExperiment={latestExperiment}
            onNavigate={setActiveTab}
            onLoadDemo={handleLoadDemo}
            isLoadingDemo={isLoadingDemo}
          />
        )}

        {activeTab === 'dataset' && (
          <DatasetView
            dataset={dataset}
            onDatasetLoaded={setDataset}
            onLoadDemo={handleLoadDemo}
            isLoadingDemo={isLoadingDemo}
          />
        )}

        {activeTab === 'setup' && (
          <SetupView
            dataset={dataset}
            onExperimentStarted={handleExperimentStarted}
          />
        )}

        {activeTab === 'monitor' && (
          <MonitorView
            currentExperiment={currentExperiment}
            onExperimentUpdated={handleExperimentUpdated}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'results' && (
          <ResultsView
            experiment={currentExperiment || latestExperiment}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'prediction' && (
          <PredictionView
            currentExperiment={currentExperiment || latestExperiment}
          />
        )}

        {activeTab === 'report' && (
          <ReportView
            currentExperiment={currentExperiment || latestExperiment}
          />
        )}
      </main>
    </div>
  );
}

export default App;
