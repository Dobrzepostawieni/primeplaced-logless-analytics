import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button, Tooltip } from '@wordpress/components';
import { copy, check } from '@wordpress/icons';
import type { MouseEvent } from 'react';
import type { ColumnDef } from '@admin/components/DataTable/types';
import type { PageStat, ReferrerStat, Error404Stat } from './types';
import { getSourceLabel as getSharedSourceLabel } from '@shared/utils/sourceLabels';
import { copyTextToClipboard } from '@shared/utils/clipboard';
import { formatPathForDisplay } from '@shared/utils/formatting';
import { useNotices } from '@shared/components/Notices';
import { ReportComparisonBadge } from '@admin/components/ReportComparisonBadge';
import { formatNumber, formatPercent } from '@shared/utils/numberFormat';

interface UrlCellProps {
	url: string;
	title: string;
}

const UrlCell = ({ url, title }: UrlCellProps) => {
	const [hasCopied, setHasCopied] = useState(false);
	const { notify } = useNotices();
	const rawUrl = url === '' ? '/' : url;
	const displayUrl = formatPathForDisplay( rawUrl );

	const handleCopy = async () => {
		const copied = await copyTextToClipboard( rawUrl );
		if ( ! copied ) {
			notify( 'COPY_ERROR' );
			return;
		}
		setHasCopied(true);
		notify( 'COPY_SUCCESS', __( 'URL copied to clipboard.', 'primeplaced-logless-analytics' ) );
		setTimeout(() => setHasCopied(false), 2000);
	};

	return (
		<div className="ppla-url-cell">
			<div
				style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
			>
				<span
					title={title}
					className="ppla-url-cell-text"
					style={{
						fontWeight: 600,
						color: '#1e1e1e',
						maxWidth: '340px',
					}}
				>
					{title}
				</span>
				<span
					title={displayUrl}
					style={{
						fontSize: '11px',
						color: '#757575',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						maxWidth: '340px',
					}}
				>
					{displayUrl}
				</span>
			</div>
			<Tooltip
				text={
					hasCopied
						? __('Copied!', 'primeplaced-logless-analytics')
						: __('Copy URL', 'primeplaced-logless-analytics')
				}
			>
		<Button
					icon={hasCopied ? check : copy}
			onClick={(event: MouseEvent<HTMLButtonElement>) => {
				event.stopPropagation();
				void handleCopy();
			}}
					variant="tertiary"
					className={`ppla-button ppla-url-cell-copy ${hasCopied ? 'is-copied' : ''}`}
					aria-label={hasCopied ? __('URL copied', 'primeplaced-logless-analytics') : __('Copy URL', 'primeplaced-logless-analytics')}
				/>
			</Tooltip>
		</div>
	);
};

export const useContentTableConfig = () => {
	const getSourceLabel = (value: string): string => {
		const source = value.trim().toLowerCase();

		if (source === 'google_ads') {
			return __('Google Ads', 'primeplaced-logless-analytics');
		}

		if (source === 'meta_ads') {
			return __('Meta Ads', 'primeplaced-logless-analytics');
		}

		return getSharedSourceLabel(value);
	};

	const pageColumns = useMemo<ColumnDef<PageStat>[]>(
		() => [
			{
				id: 'url',
				header: __('Page', 'primeplaced-logless-analytics'),
				sortable: true,
				isFixed: 'left',
				cell: (row) => <UrlCell url={row.url} title={row.title} />,
			},
			{
				id: 'views',
				header: __('Pageviews', 'primeplaced-logless-analytics'),
				sortable: true,
				cell: (row) => (
					<span>
						{formatNumber(row.views)}
						{row.previous_period && (
							<ReportComparisonBadge
								current={row.views}
								previous={row.previous_period.views}
								metricLabel={ __('pageviews', 'primeplaced-logless-analytics') }
							/>
						)}
					</span>
				),
			},
			{
				id: 'percentage',
				header: __('Share', 'primeplaced-logless-analytics'),
				sortable: true,
				cell: (row) => (
					<div className="ppla-progress-bar-wrapper">
						<div className="ppla-progress-bar">
							<div
								className="ppla-progress-bar-fill"
								style={{ width: `${row.percentage}%` }}
							/>
						</div>
						<span>
							{formatPercent(row.percentage)}
							{row.previous_period && (
								<ReportComparisonBadge
									current={row.percentage}
									previous={row.previous_period.percentage}
									metricLabel={ __('share', 'primeplaced-logless-analytics') }
									mode="points"
								/>
							)}
						</span>
					</div>
				),
			},
			{
				id: 'bounce_rate',
				header: __('Bounce Rate', 'primeplaced-logless-analytics'),
				sortable: false,
				cell: (row) => formatPercent(row.bounce_rate),
			},
			{
				id: 'avg_time',
				header: __('Avg. Time', 'primeplaced-logless-analytics'),
				sortable: false,
				cell: (row) => {
					const minutes = Math.floor(row.avg_time / 60);
					const seconds = row.avg_time % 60;
					return `${minutes}:${seconds.toString().padStart(2, '0')}`;
				},
			},
		],
		[]
	);

	const referrerColumns = useMemo<ColumnDef<ReferrerStat>[]>(
		() => [
			{
				id: 'source',
				header: __('Source', 'primeplaced-logless-analytics'),
				sortable: true,
				isFixed: 'left',
				cell: (row) => (
					<div className="ppla-source-label">
						<span title={row.source}>{getSourceLabel( row.source )}</span>
					</div>
				),
			},
			{
				id: 'visits',
				header: __('Visits', 'primeplaced-logless-analytics'),
				sortable: true,
				cell: (row) => (
					<span>
						{formatNumber(row.visits)}
						{row.previous_period && (
							<ReportComparisonBadge
								current={row.visits}
								previous={row.previous_period.visits}
								metricLabel={ __('visits', 'primeplaced-logless-analytics') }
							/>
						)}
					</span>
				),
			},
			{
				id: 'percentage',
				header: __('Share', 'primeplaced-logless-analytics'),
				sortable: true,
				cell: (row) => {
					return (
						<div className="ppla-progress-bar-wrapper">
							<div className="ppla-progress-bar">
								<div
									className="ppla-progress-bar-fill"
									style={{
										width: `${row.percentage}%`,
									}}
								/>
							</div>
							<span>
								{formatPercent(row.percentage)}
								{row.previous_period && (
									<ReportComparisonBadge
										current={row.percentage}
										previous={row.previous_period.percentage}
										metricLabel={ __('share', 'primeplaced-logless-analytics') }
										mode="points"
								/>
								)}
							</span>
						</div>
					);
				},
			},
		],
		[]
	);

	const error404Columns = useMemo<ColumnDef<Error404Stat>[]>(
		() => [
			{
				id: 'url',
				header: __('Broken URL', 'primeplaced-logless-analytics'),
				sortable: true,
				isFixed: 'left',
				cell: (row) => <UrlCell url={row.url} title={formatPathForDisplay(row.url)} />,
			},
			{
				id: 'count',
				header: __('Error Count', 'primeplaced-logless-analytics'),
				sortable: true,
				cell: (row) => (
					<span>
						{formatNumber(row.count)}
						{row.previous_period && (
							<ReportComparisonBadge
								current={row.count}
								previous={row.previous_period.count}
								metricLabel={ __('errors', 'primeplaced-logless-analytics') }
								increaseIsNegative
							/>
						)}
					</span>
				),
			},
		],
		[]
	);

	return { pageColumns, referrerColumns, error404Columns };
};
