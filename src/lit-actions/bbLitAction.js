const go = async () => {
	try {
		// Can we even import/use these?
		const { Barretenberg, UltraHonkBackend } = await import("@aztec/bb.js");

		Lit.Actions.setResponse({
			response: JSON.stringify({ success: true, message: "BB loaded" }),
		});
	} catch (e) {
		Lit.Actions.setResponse({
			response: JSON.stringify({ success: false, error: e.message }),
		});
	}
};

go();
