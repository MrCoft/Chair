export default (page, h) => ({
    twice: async (locator) => {
        await h.click(locator)
        await h.click(locator)
    },
})
