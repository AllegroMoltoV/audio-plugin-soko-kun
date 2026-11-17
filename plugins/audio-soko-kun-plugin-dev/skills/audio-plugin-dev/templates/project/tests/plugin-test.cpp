// Unit tests of the signal processing. Test the behaviour that a change could break, and confirm that each check
// fails when you break the code it guards (for example, remove the glide and see the click test fail).
#include "gain.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

namespace {

int failures = 0;

void check(bool ok, const char *what, double value = 0.0)
{
	std::printf("%s %s (value %.6g)\n", ok ? "ok  " : "FAIL", what, value);
	if (!ok)
		++failures;
}

constexpr double kRate = 48000.0;

void testUnityAndSilence()
{
	plugin::Gain gain;
	gain.setTargetDb(0.0);
	gain.prepare(kRate);
	std::vector<float> l(256, 0.5f), r(256, -0.25f);
	gain.process(l.data(), r.data(), 256);
	check(l.back() == 0.5f && r.back() == -0.25f, "0 dB passes the signal unchanged");

	plugin::Gain mute;
	mute.setTargetDb(plugin::kMinGainDb);
	mute.prepare(kRate);
	std::vector<float> m(256, 0.5f), n(256, 0.5f);
	mute.process(m.data(), n.data(), 256);
	check(m.back() == 0.0f, "the bottom of the range is silence", m.back());
}

void testGlideHasNoClick()
{
	// A jump from 0 dB to -60 dB must not change the output by more than a small step per sample.
	plugin::Gain gain;
	gain.setTargetDb(0.0);
	gain.prepare(kRate);
	std::vector<float> l(4800, 1.0f), r(4800, 1.0f);
	gain.setTargetDb(plugin::kMinGainDb);
	gain.process(l.data(), r.data(), uint32_t(l.size()));
	// Compare from the last output before the change (1.0), so that a jump at the first sample counts.
	float worst = std::fabs(l[0] - 1.0f);
	for (size_t i = 1; i < l.size(); ++i)
		worst = std::max(worst, std::fabs(l[i] - l[i - 1]));
	check(worst < 0.02f, "a gain change glides instead of jumping", worst);
	check(l.back() < 0.001f, "the glide reaches the target within 100 ms", l.back());
}

void testBlockSizesGiveTheSameOutput()
{
	std::vector<float> reference;
	for (uint32_t block : {1u, 37u, 512u}) {
		plugin::Gain gain;
		gain.setTargetDb(0.0);
		gain.prepare(kRate);
		gain.setTargetDb(-12.0);
		std::vector<float> l(2048, 1.0f), r(2048, 1.0f);
		for (uint32_t at = 0; at < l.size(); at += block)
			gain.process(l.data() + at, r.data() + at, std::min<uint32_t>(block, uint32_t(l.size()) - at));
		if (reference.empty())
			reference = l;
		check(l == reference, "the host's block size does not change the output", block);
	}
}

} // namespace

int main()
{
	testUnityAndSilence();
	testGlideHasNoClick();
	testBlockSizesGiveTheSameOutput();
	std::printf(failures == 0 ? "all tests passed\n" : "%d failures\n", failures);
	return failures == 0 ? 0 : 1;
}
