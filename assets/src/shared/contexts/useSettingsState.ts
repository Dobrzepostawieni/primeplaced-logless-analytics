import { useMemo } from '@wordpress/element';
import { useAppState } from './SettingsContext';

export const useSettingsState = () => {
	const { pplaData, proLoaded } = useAppState();
	const activePlan = pplaData.active_plan;
	const isPremium = pplaData.is_premium;

	const computedState = useMemo(() => {
		return {
			activePlan,
			isPremium,
			proLoaded,
		};
	}, [activePlan, isPremium, proLoaded]);

	return computedState;
};