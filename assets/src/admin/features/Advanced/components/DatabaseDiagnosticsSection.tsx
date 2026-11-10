/**
 * Database Diagnostics Section Component.
 *
 * @package
 */
import { __ } from '@wordpress/i18n';
import { useRef, useState, useEffect } from '@wordpress/element';
import { Card, CardBody, CardHeader, Button, Notice, Spinner } from '@wordpress/components';
import { box } from '@wordpress/icons';
import { cn } from '@shared/utils/formatting';
import type { StickySectionProps } from '@admin/components/StickyLayout';
import { useApi } from '@shared/api/useApi';
import { useNotices } from '@shared/components/Notices';
import type { DbStatsResponse } from '../types';

export const DatabaseDiagnosticsSection = ( { title, isActive, spyRef, className }: StickySectionProps ): JSX.Element => {
	const cardRef = useRef<HTMLDivElement>( null );
	const [ isOptimizing, setIsOptimizing ] = useState( false );
	const [ isLoadingStats, setIsLoadingStats ] = useState( true );
	const [ dbStats, setDbStats ] = useState<DbStatsResponse | null>( null );
	const [ hasError, setHasError ] = useState( false );
	
	const { fetchApi } = useApi();
	const { notify } = useNotices();

	useEffect( () => {
		if ( spyRef && cardRef.current ) {
			spyRef( cardRef.current );
		}
	}, [ spyRef ] );

	const fetchStats = async () => {
		setIsLoadingStats( true );
		try {
			const stats = await fetchApi<DbStatsResponse>( { path: '/ppla/v1/tools/db-stats' } );
			if ( ! stats || typeof stats.total_size !== 'string' || typeof stats.overhead !== 'string' || typeof stats.is_optimized !== 'boolean' ) {
				throw new Error( 'Invalid database diagnostics response' );
			}
			setDbStats( stats );
			setHasError( false );
		} catch {
			setHasError( true );
		} finally {
			setIsLoadingStats( false );
		}
	};

	useEffect( () => {
		void fetchStats();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	const handleOptimize = async () => {
		setIsOptimizing( true );
		try {
			await fetchApi( { path: '/ppla/v1/tools/optimize-db', method: 'POST' } );
			notify( 'DB_OPTIMIZE_SUCCESS' );
			await fetchStats();
		} catch ( error ) {
			notify( 'DB_OPTIMIZE_ERROR' );
		} finally {
			setIsOptimizing( false );
		}
	};

	const renderDiagnostics = () => {
		if ( isLoadingStats && ! dbStats ) {
			return (
				<div style={{ display: 'flex', padding: '24px 0', alignItems: 'center', gap: '8px' }}>
					<Spinner /> <span>{__( 'Loading database metrics…', 'primeplaced-logless-analytics' )}</span>
				</div>
			);
		}

		if ( dbStats ) {
			return (
				<div className="ppla-advanced-diagnostics">
					<div className="ppla-advanced-diagnostics-item">
						<span className="ppla-advanced-diagnostics-item-label">{__( 'Analytics tables size', 'primeplaced-logless-analytics' )}</span>
						<span className="ppla-advanced-diagnostics-item-value">{dbStats.total_size}</span>
					</div>
					<div className="ppla-advanced-diagnostics-item">
						<span className="ppla-advanced-diagnostics-item-label">{__( 'Reclaimable space', 'primeplaced-logless-analytics' )}</span>
						<span className="ppla-advanced-diagnostics-item-value">{dbStats.overhead}</span>
					</div>
				</div>
			);
		}

		return (
			<Notice status="error" isDismissible={false}>
				{__( 'Database metrics could not be loaded.', 'primeplaced-logless-analytics' )}{' '}
				<Button variant="link" onClick={() => void fetchStats()} disabled={isLoadingStats}>{__( 'Try again', 'primeplaced-logless-analytics' )}</Button>
			</Notice>
		);
	};

	return (
		<Card className={cn( 'ppla-settings-card', className, isActive && 'ppla-is-active' )} ref={cardRef}>
			<CardHeader className="ppla-settings-card-header">
				<h2>{title}</h2>
			</CardHeader>
			<CardBody className="ppla-settings-card-body">
				<div className="ppla-settings-card-headings">
					<h3 className="ppla-settings-card-heading">{__( 'Storage usage', 'primeplaced-logless-analytics' )}</h3>
					<p className="ppla-settings-card-description">
						{__( 'Each pageview is stored as one row and removed after the retention period. Reclaimable space is free space inside the tables that optimization returns to the database.', 'primeplaced-logless-analytics' )}
					</p>
				</div>

				{renderDiagnostics()}
				{hasError && dbStats && <Notice status="warning" isDismissible={false}>
					{__( 'Database metrics could not be refreshed. The last successful values are still shown.', 'primeplaced-logless-analytics' )}{' '}
					<Button variant="link" onClick={() => void fetchStats()} disabled={isLoadingStats}>{__( 'Try again', 'primeplaced-logless-analytics' )}</Button>
				</Notice>}

				<Button
					variant="secondary"
					icon={box}
					isBusy={isOptimizing}
					disabled={isOptimizing || isLoadingStats || !dbStats || dbStats.is_optimized}
					onClick={handleOptimize}
					className="ppla-button"
				>
					{dbStats?.is_optimized 
						? __( 'Database is fully optimized', 'primeplaced-logless-analytics' ) 
						: __( 'Optimize database tables', 'primeplaced-logless-analytics' )
					}
				</Button>
			</CardBody>
		</Card>
	);
};
