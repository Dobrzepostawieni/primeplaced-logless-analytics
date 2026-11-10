import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

interface SourceReportStatusProps {
	hasError: boolean;
	isLoading: boolean;
	hasData: boolean;
	onRetry: () => void;
}

export const SourceReportStatus = ({
	hasError,
	isLoading,
	hasData,
	onRetry,
}: SourceReportStatusProps): JSX.Element | null => {
	if ( ! hasError ) {
		return null;
	}

	return (
		<div className="ppla-source-report-status">
			{hasError && (
				<Notice status="error" isDismissible={false}>
					{hasData
						? __(
								'We could not refresh this report. Your last available rows are still shown.',
								'primeplaced-logless-analytics'
							)
						: __(
								'We could not load this report. Please try again.',
								'primeplaced-logless-analytics'
							)}{' '}
					<Button
						variant="link"
						onClick={onRetry}
						disabled={isLoading}
					>
						{__( 'Try again', 'primeplaced-logless-analytics' )}
					</Button>
				</Notice>
			)}
		</div>
	);
};
