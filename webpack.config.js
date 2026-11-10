const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const DependencyExtractionWebpackPlugin = require('@wordpress/dependency-extraction-webpack-plugin');

class PplaBuildRevisionPlugin {
	apply(compiler) {
		compiler.hooks.thisCompilation.tap(
			'PplaBuildRevisionPlugin',
			(compilation) => {
				compilation.hooks.processAssets.tap(
					{
						name: 'PplaBuildRevisionPlugin',
						stage: compiler.webpack.Compilation
							.PROCESS_ASSETS_STAGE_SUMMARIZE,
					},
					() => {
						const revision =
							compilation.fullHash || compilation.hash;

						if (!revision) {
							return;
						}

						compilation.emitAsset(
							'ppla-build-revision.php',
							new compiler.webpack.sources.RawSource(
								`<?php return '${revision}';\n`
							)
						);
					}
				);
			}
		);
	}
}

const apps = {
	'primeplaced-logless-analytics-admin': { path: 'admin/index', src: 'src' },
	'primeplaced-logless-analytics-public': { path: 'front/index', src: 'src' },
};

const entry = {};

Object.entries(apps).forEach(([outputName, config]) => {
	entry[outputName] = path.resolve(
		process.cwd(),
		`assets/${config.src}/${config.path}.tsx`
	);
});

/**
 *
 * @param rules
 */
function updateRules(rules) {
	return rules.map((rule) => {
		if (Array.isArray(rule.use)) {
			rule.use = rule.use.map((u) => {
				const isSass =
					(typeof u === 'string' && u.includes('sass-loader')) ||
					(typeof u === 'object' &&
						u.loader &&
						u.loader.includes('sass-loader'));

				if (isSass) {
					const existingOptions =
						typeof u === 'object' && u.options ? u.options : {};

					return {
						loader: require.resolve('sass-loader'),
						options: {
							...existingOptions,
							sourceMap: true,
							api: 'modern',
							webpackImporter: true,
							sassOptions: {
								loadPaths: [
									path.resolve(process.cwd(), 'node_modules'),
									path.resolve(process.cwd(), 'assets/src'),
								],
								quietDeps: true,
								silenceDeprecations: ['legacy-js-api'],
							},
						},
					};
				}

				return u;
			});
		}

		if (rule.oneOf) {
			rule.oneOf = updateRules(rule.oneOf);
		}

		return rule;
	});
}

const rulesWithSassFix = updateRules(defaultConfig.module.rules);

const customMinimizers = (defaultConfig.optimization.minimizer || []).map(
	(plugin) => {
		if (plugin.constructor.name === 'TerserPlugin') {
			plugin.options.extractComments = false;
			plugin.options.terserOptions = {
				...plugin.options.terserOptions,
				format: {
					...(plugin.options.terserOptions?.format || {}),
					comments: false,
				},
			};
		}
		return plugin;
	}
);

const pluginsWithBundledWpUi = defaultConfig.plugins.map((plugin) => {
	if (plugin.constructor.name === 'MiniCssExtractPlugin') {
		return new plugin.constructor({
			...plugin.options,
			chunkFilename: '[name].[contenthash].css',
		});
	}

	if (plugin.constructor.name !== 'DependencyExtractionWebpackPlugin') {
		return plugin;
	}

	return new DependencyExtractionWebpackPlugin({
		...plugin.options,
		requestToExternal: (request) => {
			if (request === '@wordpress/ui') {
				return false;
			}

			return plugin.options.requestToExternal?.(request);
		},
	});
});

module.exports = {
	...defaultConfig,
	entry,
	output: {
		path: path.join(__dirname, './assets/build'),
		filename: '[name].js',
		chunkFilename: '[name].[contenthash].js',
	},
	resolve: {
		...defaultConfig.resolve,
		alias: {
			'@admin': path.resolve(process.cwd(), 'assets/src/admin'),
			'@shared': path.resolve(process.cwd(), 'assets/src/shared'),
			'@features': path.resolve(process.cwd(), 'assets/src/admin/features'),
			'@images': path.resolve(process.cwd(), 'assets/images'),
		},
		extensions: [
			'.ts',
			'.tsx',
			'.js',
			'.jsx',
			...defaultConfig.resolve.extensions,
		],
	},
	externals: {
		react: 'React',
		'react-dom': 'ReactDOM',
		...defaultConfig.externals,
	},
	module: {
		...defaultConfig.module,
		rules: rulesWithSassFix,
	},
	optimization: {
		...defaultConfig.optimization,
		minimize: true,
		minimizer: customMinimizers,
	},
	plugins: [
		...pluginsWithBundledWpUi,
		new PplaBuildRevisionPlugin(),
	],
	performance: {
		...defaultConfig.performance,
		maxEntrypointSize: 512000,
		maxAssetSize: 512000,
	},
};
