#pragma once



#include "screen.h"




typedef enum SCREEN_LoadConfigFileError
{
    SCREEN_LoadConfigFileError_NONE = 0,

    SCREEN_LoadConfigFileError_NoFile,
    SCREEN_LoadConfigFileError_FileUnkExt,
    SCREEN_LoadConfigFileError_FileInvalid,

    SCREEN_NumLoadConfigFileErrors
} SCREEN_LoadConfigFileError;


SCREEN_LoadConfigFileError SCREEN_loadConfigFile(const char* filename);




































































