module.exports = config => ({
  ...config,

  resolve: {
    ...config.resolve,

    fallback: {
      ...config.resolve.fallback,

      assert: require.resolve("assert")
    }
  }
});
