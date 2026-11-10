/**
 * Core maintenance actions for the analytics queue.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';
import { Card, CardBody, CardHeader, Button } from '@wordpress/components';
import { update } from '@wordpress/icons';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { useApi } from '@shared/api/useApi';
import { useNotices } from '@shared/components/Notices';
import { useAppDispatch } from '@shared/contexts';

export const MaintenanceSection = ({
	title,
	isActive,
	spyRef,
	className,
}: StickySectionProps): JSX.Element => {
	const cardRef = useRef<HTMLDivElement>(null);
	const [isAggregating, setIsAggregating] = useState(false);
	const { fetchApi } = useApi();
	const { notify } = useNotices();
	const { triggerDataRefresh } = useAppDispatch();

	useEffect(() => {
		if (spyRef && cardRef.current) {
			spyRef(cardRef.current);
		}
	}, [spyRef]);

	const handleForceAggregation = async () => {
		setIsAggregating(true);

		try {
			const response = await fetchApi<{
				status: string;
				flushed: number;
				execution_time: number;
			}>({
				path: '/ppla/v1/tools/flush-buffer',
				method: 'POST',
			});

			if (response.flushed === 0) {
				notify('BUFFER_FLUSH_EMPTY');
			} else {
				notify('BUFFER_FLUSH_SUCCESS', [
					response.flushed,
					response.execution_time,
				]);
				triggerDataRefresh();
			}
		} catch (error) {
			notify('BUFFER_FLUSH_ERROR');
		} finally {
			setIsAggregating(false);
		}
	};

	return (
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
							'Force buffer queue aggregation',
							'primeplaced-logless-analytics'
						)}
					</h3>
					<p className="ppla-settings-card-description">
						{__(
							'Use this only when queued hits need to be processed before the next scheduled WP-Cron run.',
							'primeplaced-logless-analytics'
						)}
					</p>
				</div>
				<Button
					variant="secondary"
					icon={update}
					isBusy={isAggregating}
					disabled={isAggregating}
					onClick={handleForceAggregation}
					className="ppla-button"
				>
					{__('Run WP-Cron now', 'primeplaced-logless-analytics')}
				</Button>
			</CardBody>
		</Card>
	);
};
