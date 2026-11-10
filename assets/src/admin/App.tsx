import { AppProvider, SettingsProvider } from '@shared/contexts';
import { SavedViewsProvider } from './components/SavedViews/SavedViewsContext';
import { AppContent } from './AppContent';
import './App.scss';

export const App = (): JSX.Element => {
	return (
		<AppProvider>
			<SettingsProvider>
				<SavedViewsProvider>
					<AppContent />
				</SavedViewsProvider>
			</SettingsProvider>
		</AppProvider>
	);
};
