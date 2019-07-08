#pragma once



#include "screen.h"

#include <vec.h>




typedef enum SCREEN_LoadSceneFileError
{
    SCREEN_LoadSceneFileError_NONE = 0,

    SCREEN_LoadSceneFileError_NoFile,
    SCREEN_LoadSceneFileError_NoEntryFile,
    SCREEN_LoadSceneFileError_FileUnkExt,
    SCREEN_LoadSceneFileError_FileInvalid,

    SCREEN_NumLoadSceneFileErrors
} SCREEN_LoadSceneFileError;


SCREEN_LoadSceneFileError SCREEN_loadSceneFile(const char* filename, vec_char* pathBuf);









































































































