cmake_minimum_required (VERSION 3.5)
project (SCREEN)


set_property (GLOBAL PROPERTY USE_FOLDERS ON)

set (CMAKE_C_STANDARD 11)
set (CMAKE_CXX_STANDARD 11)
find_package (Threads REQUIRED)


list (APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}")
include (ExternalProject)
include (FeatureSummary)
include (CMakeDependentOption)


set (IMPLIB_DIR "imp")

set (SDL_DIR ${IMPLIB_DIR}/sdl)
include_directories (${SDL_DIR}/include)
link_directories (${SDL_DIR}/build/${ConfigurationName})

set (UV_DIR ${IMPLIB_DIR}/uv)
include_directories (${UV_DIR}/include)
link_directories (${UV_DIR}/build/${ConfigurationName})

set (CURL_DIR ${IMPLIB_DIR}/curl)
include_directories (${CURL_DIR}/include)
link_directories (${CURL_DIR}/lib)


include_directories (.)
add_definitions (-D_UNICODE -D_CRT_SECURE_NO_WARNINGS -D_USE_MATH_DEFINES)

if ("${CMAKE_CXX_COMPILER_ID}" STREQUAL "MSVC")
    add_definitions (-D_HAS_EXCEPTIONS=0)
endif ()



if (MSVC)
    set (CMAKE_C_FLAGS "/W3 /WX")
endif ()
if (CMAKE_COMPILER_IS_GNUCC)
    set (CMAKE_C_FLAGS "-std=c11 -Wall -Wno-unused-function -DHAVE_PTHREAD -D_GNU_SOURCE -D_O_CLOEXEC")
endif ()


set (CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} -DDEBUG")
set (CMAKE_C_FLAGS_MINSIZEREL "${CMAKE_C_FLAGS_MINSIZEREL} -DDEBUG")
set (CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} -DNDEBUG")
set (CMAKE_C_FLAGS_RELWITHDEBINFO "${CMAKE_C_FLAGS_RELWITHDEBINFO} -DDEBUG")



include_directories (imp)
include_directories (imp/glad/include)
include_directories (imp/vec)
include_directories (imp/fileu)
include_directories (imp/argparse)
include_directories (imp/nxjson)
include_directories (imp/stb)
include_directories (imp/gettimeofday)
include_directories (imp/threads)
include_directories (imp/webby)
include_directories (imp/base64)
include_directories (imp/log.c)

file (GLOB IMP_SRC_FILES
    imp/*.h
    imp/glad/include/KHR/*.h
    imp/glad/include/glad/*.h
    imp/glad/src/*.c
    imp/vec/*.h
    imp/vec/*.c
    imp/fileu/*.h
    imp/fileu/*.c
    imp/argparse/*.h
    imp/argparse/*.c
    imp/nxjson/*.h
    imp/nxjson/*.c
    imp/stb/*.h
    imp/stb/*.c
    imp/gettimeofday/*.h
    imp/gettimeofday/*.c
    imp/threads/threads.h
    imp/webby/*.h
    imp/webby/*.c
    imp/base64/*.h
    imp/base64/*.c
    imp/log.c/*.h
    imp/log.c/*.c
    )
list(FILTER IMP_SRC_FILES EXCLUDE REGEX "main.c$")

source_group (imp FILES ${IMP_SRC_FILES})
add_library (imp STATIC ${IMP_SRC_FILES})
set_target_properties (imp PROPERTIES FOLDER imp)


include_directories (imp/zf_log)
add_subdirectory (imp/zf_log)
set_target_properties (zf_log PROPERTIES FOLDER imp)


file (GLOB SRC_FILES *.h *.c)
source_group (src FILES ${SRC_FILES})
add_library (screen ${SRC_FILES})
set_target_properties (screen PROPERTIES FOLDER screen)


include_directories (SceneLoader)
file (GLOB SCENE_LOADER_SRC_FILES SceneLoader/*.h SceneLoader/*.c)
source_group (src FILES ${SCENE_LOADER_SRC_FILES})
add_library (ScreenSceneLoader ${SCENE_LOADER_SRC_FILES})
set_target_properties (ScreenSceneLoader PROPERTIES FOLDER screen/loaders)


include_directories (ConfigLoader)
file (GLOB CONFIG_LOADER_SRC_FILES ConfigLoader/*.h ConfigLoader/*.c)
source_group (src FILES ${CONFIG_LOADER_SRC_FILES})
add_library (ScreenConfigLoader ${CONFIG_LOADER_SRC_FILES})
set_target_properties (ScreenConfigLoader PROPERTIES FOLDER screen/loaders)


include_directories (FileWatcher)
file (GLOB FILEWATCHER_SRC_FILES FileWatcher/*.h FileWatcher/*.c)
source_group (src FILES ${FILEWATCHER_SRC_FILES})
add_library (ScreenFileWatcher ${FILEWATCHER_SRC_FILES})
set_target_properties (ScreenFileWatcher PROPERTIES FOLDER screen)


include_directories (Console)
file (GLOB CONSOLE_SRC_FILES Console/*.h Console/*.c)
source_group (src FILES ${CONSOLE_SRC_FILES})
add_library (ScreenConsole ${CONSOLE_SRC_FILES})
set_target_properties (ScreenConsole PROPERTIES FOLDER screen)


include_directories (Utils)
file (GLOB UTILS_SRC_FILES Utils/*.h Utils/*.c)
source_group (src FILES ${UTILS_SRC_FILES})
add_library (ScreenUtils ${UTILS_SRC_FILES})
set_target_properties (ScreenUtils PROPERTIES FOLDER screen)



file (GLOB TESTS_SRC_FILES player/*.h player/*.c)
source_group (src FILES ${TESTS_SRC_FILES})
add_executable (player ${TESTS_SRC_FILES})
target_link_libraries (player
    imp screen
    ScreenSceneLoader ScreenConfigLoader ScreenFileWatcher ScreenConsole ScreenUtils
    )
if (WIN32)
else ()
    target_link_libraries (player m)
endif ()

if (NOT DEFINED EMSCRIPTEN)
    target_link_libraries (player SDL2)
endif ()
if (NOT DEFINED EMSCRIPTEN)
    if (WIN32)
        target_link_libraries (
            player opengl32 uv_a zf_log
            version winmm imm32
            wldap32 crypt32 ws2_32 normaliz
            userenv psapi iphlpapi
            )
    else ()
        target_link_libraries (player GL uv zf_log)
    endif ()
endif ()


































































