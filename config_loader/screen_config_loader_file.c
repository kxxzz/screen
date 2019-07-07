#include "screen_config_loader_file.h"
#include "screen_a.h"

#include <fileu.h>
#include <vec.h>
#include <nxjson.h>







SCREEN_LoadConfigFileError SCREEN_loadConfigFromJson(char* code)
{
    const nx_json* root = nx_json_parse(code, NULL);
    if (!root)
    {
        // todo report error
        return SCREEN_LoadConfigFileError_FileInvalid;
    }
    const nx_json* renderScale = nx_json_get(root, "renderScale");
    if (renderScale->type != NX_JSON_NULL)
    {
        if ((renderScale->type != NX_JSON_INTEGER) &&
            (renderScale->type != NX_JSON_DOUBLE))
        {
            // todo report error
            goto error;
        }
        f32 scale;
        if (NX_JSON_DOUBLE == renderScale->type)
        {
            scale = (f32)renderScale->dbl_value;
        }
        else
        {
            assert(NX_JSON_INTEGER == renderScale->type);
            scale = (f32)renderScale->int_value;
        }
        SCREEN_setRenderScale(scale);
    }

    nx_json_free(root);
    return SCREEN_LoadConfigFileError_NONE;
error:
    nx_json_free(root);
    return SCREEN_LoadConfigFileError_FileInvalid;
}




SCREEN_LoadConfigFileError SCREEN_loadConfigFile(const char* filename)
{
    if (FILEU_fileExist(filename))
    {
        if (0 == strcicmp(FILEU_filenameExt(filename), "json"))
        {
            u32 size = FILEU_readFile(filename, NULL, 0);
            if ((-1 == size) || !size)
            {
                // todo report error
                return SCREEN_LoadConfigFileError_FileInvalid;
            }
            char* buf = malloc(size + 1);
            size = FILEU_readFile(filename, buf, size);
            buf[size] = 0;

            SCREEN_LoadConfigFileError r = SCREEN_loadConfigFromJson(buf);
            free(buf);
            return r;
        }
        else
        {
            // todo report error
            return SCREEN_LoadConfigFileError_FileUnkExt;
        }
    }
    else
    {
        // todo report error
        return SCREEN_LoadConfigFileError_NoFile;
    }
}






























































































