/**
 * Data Management Section Component.
 *
 * @package
 */
import { PplaSelectControl } from '@shared/components/PplaSelectControl';
import { __ } from '@wordpress/i18n';
import { useRef, useState, useEffect } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import {
	Card,
	CardBody,
	CardHeader,
	Button} from '@wordpress/components';
import { download } from '@wordpress/icons';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { useApi } from '@shared/api/useApi';
import { useNotices } from '@shared/components/Notices';
import { useAppDispatch } from '@shared/contexts';
import { ConfirmModal } from '@admin/components/ConfirmModal';

export const DataManagementSection = ({
	title,
	isActive,
	spyRef,
	className,
}: StickySectionProps): JSX.Element => {
	const cardRef = useRef<HTMLDivElement>(null);
	const [isClearing, setIsClearing] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [retentionDays, setRetentionDays] = useState('30');

	const [isClearModalOpen, setIsClearModalOpen] = useState(false);

	const { fetchApi } = useApi();
	const { notify } = useNotices();
	const { triggerDataRefresh } = useAppDispatch();

	useEffect(() => {
		if (spyRef && cardRef.current) {
			spyRef(cardRef.current);
		}
	}, [spyRef]);

	const confirmClearData = async () => {
		setIsClearing(true);

		try {
			let hasMore = true;

			while (hasMore) {
				const response = await fetchApi<{
					status: string;
					has_more?: boolean;
				}>({
					path: '/ppla/v1/tools/clear-data',
					method: 'POST',
					data: { days: retentionDays },
				});

				hasMore = !!response.has_more;
			}

			notify('DATA_CLEARED_SUCCESS');
			triggerDataRefresh();
			setIsClearModalOpen(false);
		} catch (error) {
			notify('DATA_CLEAR_ERROR');
			setIsClearModalOpen(false);
		} finally {
			setIsClearing(false);
		}
	};

	const handleExportCSV = async () => {
		setIsExporting(true);
		try {
			const response = await fetchApi<{ url: string }>({
				path: '/ppla/v1/tools/export-csv',
				method: 'POST',
			});

			if (response.url) {
				window.location.href = response.url;
			}
		} catch (error) {
			notify('EXPORT_ERROR');
		} finally {
			setIsExporting(false);
		}
	};

	const proExportButtons = applyFilters('ppla.advanced.exportButtons', null);

	const retentionOptions = [
		{ label: __('7 days', 'primeplaced-logless-analytics'), value: '7' },
		{ label: __('14 days', 'primeplaced-logless-analytics'), value: '14' },
		{ label: __('30 days', 'primeplaced-logless-analytics'), value: '30' },
		{ label: __('90 days', 'primeplaced-logless-analytics'), value: '90' },
		{
			label: __('180 days', 'primeplaced-logless-analytics'),
			value: '180',
		},
		{
			label: __('All data', 'primeplaced-logless-analytics'),
			value: 'all',
		},
	];

	return (
		<>
			<Card
				className={cn(
					'ppla-settings-card',
					className,
					isActive && 'ppla-is-active'
				)}
				ref={cardRef}
			>
				<CardHeader className="ppla-settings-card-header">
					<h2>{title}</h2>
				</CardHeader>
				<CardBody className="ppla-settings-card-body">
					<div className="ppla-settings-card-headings">
						<h3 className="ppla-settings-card-heading">
							{__(
								'Clear data older than',
								'primeplaced-logless-analytics'
							)}
						</h3>
					</div>
					<div className="ppla-settings-card-row">
						<PplaSelectControl
							label={__(
								'Retention period',
								'primeplaced-logless-analytics'
							)}
							value={retentionDays}
							options={retentionOptions}
							onChange={(val: string) => setRetentionDays(val)}
							className="ppla-select-control"
						/>
						<Button
							variant="secondary"
							onClick={() => setIsClearModalOpen(true)}
							isBusy={isClearing}
							disabled={isClearing}
							className="ppla-button ppla-advanced-datamanagment-button"
							isDestructive
						>
							{__('Clear now', 'primeplaced-logless-analytics')}
						</Button>
					</div>
					<p className="ppla-help ppla-help--muted">
						{__(
							'This permanently removes matching analytics records. Settings and custom event definitions are kept.',
							'primeplaced-logless-analytics'
						)}
					</p>

					<div className="ppla-settings-card-headings">
						<h3 className="ppla-settings-card-heading">
							{__('Export data', 'primeplaced-logless-analytics')}
						</h3>
					</div>
					<Button
						variant="primary"
						icon={download}
						onClick={handleExportCSV}
						isBusy={isExporting}
						disabled={isExporting}
						className="ppla-button"
					>
						{__('Export CSV', 'primeplaced-logless-analytics')}
					</Button>
					{proExportButtons}
				</CardBody>
			</Card>

			<ConfirmModal
				isOpen={isClearModalOpen}
				title={__(
					'Clear database records',
					'primeplaced-logless-analytics'
				)}
				message={__(
					'Are you sure you want to permanently delete this data? This action cannot be undone.',
					'primeplaced-logless-analytics'
				)}
				confirmLabel={__('Clear data', 'primeplaced-logless-analytics')}
				onConfirm={confirmClearData}
				onCancel={() => setIsClearModalOpen(false)}
				isConfirming={isClearing}
				isDestructive={true}
			/>
		</>
	);
};
