cmake_minimum_required (VERSION 3.5)
project (SCREEN)


set (CMAKE_C_STANDARD 11)
set (CMAKE_CXX_STANDARD 11)
find_package (Threads REQUIRED)


list (APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}")
include (ExternalProject)
include (FeatureSummary)
include (CMakeDependentOption)



set (IMPLIB_DIR "imp")

set (GL3W_DIR ${IMPLIB_DIR}/gl3w)
include_directories (${GL3W_DIR}/include)
link_directories (${GL3W_DIR}/build/${ConfigurationName})

set (SDL_DIR ${IMPLIB_DIR}/sdl)
include_directories (${SDL_DIR}/include)
link_directories (${SDL_DIR}/build/${ConfigurationName})


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



include_directories (imp/vec)
include_directories (imp/fileu)
include_directories (imp/argparse)
include_directories (imp/nxjson)

file (GLOB IMP_SRC_FILES
    imp/vec/*.h
    imp/vec/*.c
    imp/fileu/*.h
    imp/fileu/*.c
    imp/argparse/*.h
    imp/argparse/*.c
    imp/nxjson/*.h
    imp/nxjson/*.c
    )
list(FILTER IMP_SRC_FILES EXCLUDE REGEX "main.c$")

source_group (imp FILES ${IMP_SRC_FILES})
add_library (imp STATIC ${IMP_SRC_FILES})


file (GLOB SRC_FILES *.h *.c)
source_group (src FILES ${SRC_FILES})
add_library (screen ${SRC_FILES})


include_directories (scene_loader)
file (GLOB SCENE_LOADER_SRC_FILES scene_loader/*.h scene_loader/*.c)
source_group (src FILES ${SCENE_LOADER_SRC_FILES})
add_library (scene_loader ${SCENE_LOADER_SRC_FILES})


include_directories (config_loader)
file (GLOB CONFIG_LOADER_SRC_FILES config_loader/*.h config_loader/*.c)
source_group (src FILES ${CONFIG_LOADER_SRC_FILES})
add_library (config_loader ${CONFIG_LOADER_SRC_FILES})



file (GLOB TESTS_SRC_FILES player/*.h player/*.c)
source_group (src FILES ${TESTS_SRC_FILES})
add_executable (player ${TESTS_SRC_FILES})
target_link_libraries (player imp screen scene_loader config_loader)
if (WIN32)
else ()
    target_link_libraries (player m)
endif ()

if (NOT DEFINED EMSCRIPTEN)
    target_link_libraries (player SDL2)
endif ()
if (NOT DEFINED EMSCRIPTEN)
    if (WIN32)
        target_link_libraries (player opengl32 gl3w version winmm imm32)
    else ()
        target_link_libraries (player GL gl3w)
    endif ()
endif ()


































































