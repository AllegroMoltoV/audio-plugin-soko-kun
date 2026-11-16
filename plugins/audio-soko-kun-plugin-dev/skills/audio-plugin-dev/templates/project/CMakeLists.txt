cmake_minimum_required(VERSION 3.21)

# ---- Change these for your plugin. The rest of the file reads them. ----
# PRODUCT_NAME is the file name of the bundles and the name hosts show. PLUGIN_ID is a reverse-domain ID that must
# never change after the first release, because hosts and saved projects find the plugin by it (stable-plugin-id).
project(my-gain-audio VERSION 1.0.0 LANGUAGES C CXX)
set(PRODUCT_NAME "My Gain")
set(PLUGIN_ID "com.example.my-gain")
set(PLUGIN_VENDOR "Your Name")
set(PLUGIN_URL "https://github.com/your-account/my-gain-audio")
set(ARCHIVE_PREFIX "my-gain")
# -------------------------------------------------------------------------

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# Link the C runtime statically so users need no Visual C++ redistributable.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
# The static libraries below are linked into the plugin modules. Only the symbols marked for export,
# such as clap_entry, GetPluginFactory, and the VST 3 module entry points, stay visible.
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_C_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)

option(PLUGIN_SANITIZE "Build the unit tests with AddressSanitizer and UndefinedBehaviorSanitizer (GCC and Clang only)" OFF)

# Hardening applies to every compiled source, including the SDKs that FetchContent adds below (build-hardening).
if(MSVC)
  add_compile_options(/GS /guard:cf)
else()
  add_compile_options(-fstack-protector-strong -D_FORTIFY_SOURCE=2)
endif()

include(FetchContent)
# clap-wrapper, pinned to a commit (dependency-pinning). It downloads the CLAP and VST 3 SDKs at the versions it pins.
# Before the first push, update this to the newest release of clap-wrapper and its commit SHA.
set(CLAP_WRAPPER_DOWNLOAD_DEPENDENCIES TRUE CACHE BOOL "" FORCE)
set(CLAP_WRAPPER_BUILD_AUV2 FALSE CACHE BOOL "" FORCE)
FetchContent_Declare(
  clap-wrapper
  GIT_REPOSITORY https://github.com/free-audio/clap-wrapper.git
  GIT_TAG 806bba0a5f792e3966b99c1561ab9952d3316d7c # v0.17.0
)
FetchContent_MakeAvailable(clap-wrapper)

add_library(plugin-impl STATIC src/plugin.cpp)
target_include_directories(plugin-impl PUBLIC src)
# clapwrapper/vst3.h, for the VST 3 factory information returned in src/plugin.cpp.
target_include_directories(plugin-impl PRIVATE "${clap-wrapper_SOURCE_DIR}/include")
target_compile_definitions(plugin-impl PRIVATE
  PLUGIN_VERSION="${PROJECT_VERSION}" PLUGIN_ID="${PLUGIN_ID}" PLUGIN_NAME="${PRODUCT_NAME}"
  PLUGIN_VENDOR="${PLUGIN_VENDOR}" PLUGIN_URL="${PLUGIN_URL}")
target_link_libraries(plugin-impl PUBLIC clap)
if(MSVC)
  target_compile_options(plugin-impl PRIVATE /W4 /permissive-)
else()
  target_compile_options(plugin-impl PRIVATE -Wall -Wextra)
endif()

make_clapfirst_plugins(
  TARGET_NAME plugin
  IMPL_TARGET plugin-impl
  OUTPUT_NAME "${PRODUCT_NAME}"
  ENTRY_SOURCE src/plugin-entry.cpp
  BUNDLE_IDENTIFIER "${PLUGIN_ID}"
  BUNDLE_VERSION ${PROJECT_VERSION}
  COPY_AFTER_BUILD FALSE
  # VST 3 hosts and Audio Plugin Soko-kun both expect the bundle folder layout on Windows.
  WINDOWS_FOLDER_VST3 TRUE
  PLUGIN_FORMATS CLAP VST3
  ASSET_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/assets
)

foreach(module IN ITEMS plugin_clap plugin_vst3)
  if(MSVC)
    target_link_options(${module} PRIVATE /guard:cf /DYNAMICBASE /HIGHENTROPYVA)
  else()
    # The statically linked C++ runtime keeps the plugins independent of the libstdc++ version of the
    # distribution, and stays hidden. --exclude-libs,ALL would also hide the VST 3 module entry points
    # ModuleEntry and ModuleExit, which the VST 3 SDK defines in a static library.
    target_link_options(${module} PRIVATE -static-libstdc++ -static-libgcc
                        -Wl,--exclude-libs,libstdc++.a:libgcc.a:libgcc_eh.a -Wl,-z,relro,-z,now -Wl,--no-undefined)
  endif()
endforeach()

include(CTest)
if(BUILD_TESTING)
  # The test checks the signal processing in src/gain.h, which does not depend on CLAP.
  add_executable(plugin-test tests/plugin-test.cpp)
  target_include_directories(plugin-test PRIVATE src)
  add_test(NAME plugin COMMAND plugin-test)
  if(PLUGIN_SANITIZE AND NOT MSVC)
    set(sanitize_flags -fsanitize=address,undefined -fno-sanitize-recover=undefined -fno-omit-frame-pointer)
    target_compile_options(plugin-test PRIVATE ${sanitize_flags})
    target_link_options(plugin-test PRIVATE -fsanitize=address,undefined)
  endif()
endif()

# Release layout: `cmake --install build --config Release --prefix dist`, then zip the contents of dist.
# The archive carries the license texts of everything linked into the plugins (license-notices). Add a line for
# every library you add. clap-wrapper downloads the SDKs to these places; a layout change in a new clap-wrapper
# fails here.
set(LICENSE_FILES
  "${CMAKE_BINARY_DIR}/cpm/vst3sdk/LICENSE.txt|vst3sdk.txt"
  "${clap-wrapper_BINARY_DIR}/cpm/clap/LICENSE|clap.txt"
  "${clap-wrapper_SOURCE_DIR}/LICENSE|clap-wrapper.txt"
)
foreach(entry IN LISTS LICENSE_FILES)
  string(REPLACE "|" ";" parts "${entry}")
  list(GET parts 0 source)
  list(GET parts 1 name)
  if(NOT EXISTS "${source}")
    message(FATAL_ERROR "License file not found: ${source}")
  endif()
  install(FILES "${source}" DESTINATION THIRD_PARTY_LICENSES RENAME "${name}")
endforeach()
# fmt, which clap-wrapper uses, keeps its license in the leading comment of format.h.
file(READ "${clap-wrapper_SOURCE_DIR}/libs/fmt/fmt/format.h" FMT_HEADER)
string(FIND "${FMT_HEADER}" "*/" FMT_COMMENT_END)
string(SUBSTRING "${FMT_HEADER}" 0 ${FMT_COMMENT_END} FMT_LICENSE_TEXT)
string(REGEX REPLACE "^/\\*\n" "" FMT_LICENSE_TEXT "${FMT_LICENSE_TEXT}")
file(WRITE "${CMAKE_BINARY_DIR}/fmt-LICENSE.txt" "${FMT_LICENSE_TEXT}")
install(FILES "${CMAKE_BINARY_DIR}/fmt-LICENSE.txt" DESTINATION THIRD_PARTY_LICENSES RENAME fmt.txt)

# clap-wrapper puts the Windows plugins in per-format folders and the Linux plugins directly in the asset folder.
if(WIN32)
  set(VST3_BUNDLE "${CMAKE_BINARY_DIR}/assets/VST3/${PRODUCT_NAME}.vst3")
else()
  set(VST3_BUNDLE "${CMAKE_BINARY_DIR}/assets/${PRODUCT_NAME}.vst3")
endif()
install(DIRECTORY "${VST3_BUNDLE}" DESTINATION VST3)
install(FILES "$<TARGET_FILE:plugin_clap>" DESTINATION CLAP)
install(FILES LICENSE DESTINATION . RENAME LICENSE.txt)
install(FILES packaging/README.txt DESTINATION .)
