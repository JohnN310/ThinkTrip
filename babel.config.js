module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // ... your other plugins, if any ...
            'react-native-reanimated/plugin', // MUST BE LAST
        ],
    };
};