import { createContext, useContext } from '@wordpress/element';
import type { DataTableContextValue } from './types';

const DT_KEY = 'pplaDataTableContext_v1';
type DataTableRegistry = Record<string, unknown>;

const registry = window as unknown as DataTableRegistry;

if (!registry[DT_KEY]) {
	registry[DT_KEY] = createContext<DataTableContextValue<unknown> | null>(
		null
	);
}

const DataTableContext = registry[DT_KEY] as React.Context<
	DataTableContextValue<unknown> | null
>;

export const DataTableProvider = <T,>({
	value,
	children,
}: {
	value: DataTableContextValue<T>;
	children: React.ReactNode;
}) => (
	<DataTableContext.Provider
		value={value as unknown as DataTableContextValue<unknown>}
	>
		{children}
	</DataTableContext.Provider>
);

export const useDataTableContext = <T,>() => {
	const context = useContext(DataTableContext) as
		| DataTableContextValue<T>
		| undefined;
	if (!context) {
		throw new Error(
			'useDataTableContext must be used within a DataTableProvider'
		);
	}
	return context;
};

/** Same context without the provider requirement, for controls used outside tables. */
export const useOptionalDataTableContext = <T,>() =>
	(useContext(DataTableContext) as DataTableContextValue<T> | null) ?? null;
