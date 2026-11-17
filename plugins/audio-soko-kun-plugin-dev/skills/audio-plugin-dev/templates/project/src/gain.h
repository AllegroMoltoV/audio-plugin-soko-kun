#pragma once

#include <cmath>
#include <cstdint>

// The signal processing, kept free of CLAP so that the unit test can call it directly.
namespace plugin {

constexpr double kMinGainDb = -60.0;
constexpr double kMaxGainDb = 12.0;

// -60 dB and below is silence.
inline float dbToGain(double db)
{
	return db <= kMinGainDb ? 0.0f : float(std::pow(10.0, db / 20.0));
}

// A stereo gain that glides towards a new value, so that a parameter change does not click.
// prepare() may allocate; process() is real-time safe: no allocation, no locks, no system calls (realtime-safety).
class Gain {
public:
	void prepare(double sampleRate)
	{
		// The glide covers 99 % of a change in about 20 ms.
		coefficient_ = float(1.0 - std::exp(-1.0 / (0.0043 * sampleRate)));
		current_ = target_;
	}

	void setTargetDb(double db)
	{
		target_ = dbToGain(db);
	}

	void process(float *left, float *right, uint32_t frames)
	{
		float g = current_;
		for (uint32_t i = 0; i < frames; ++i) {
			g += coefficient_ * (target_ - g);
			left[i] *= g;
			right[i] *= g;
		}
		current_ = g;
	}

	float current() const
	{
		return current_;
	}

private:
	float target_ = 1.0f;
	float current_ = 1.0f;
	float coefficient_ = 1.0f;
};

} // namespace plugin
