import type { PplaFrontData, PplaData } from '@shared/types';

declare global {
	interface Window {
		jQuery?: JQueryStatic;
		pplaFrontendData?: PplaFrontData;
		pplaAdminData?: PplaData;
		ppla?: ( command: 'track', eventName: string, value?: number ) => void;
	}
}
