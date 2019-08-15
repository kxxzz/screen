#include "screen_configloader_file.h"
#include "screen_a.h"

#include <fileu.h>
#include <vec.h>
#include <nxjson.h>







SCREEN_LoadFileError SCREEN_loadConfigFromJson(char* code)
{
    const nx_json* root = nx_json_parse(code, NULL);
    if (!root)
    {
        // todo report error
        return SCREEN_LoadFileError_FileInvalid;
    }
    if (root->type != NX_JSON_OBJECT)
    {
        // todo report error
        goto error;
    }

    const nx_json* renderScale = nx_json_get(root, "renderScale");
    const nx_json* renderSize = nx_json_get(root, "renderSize");

    if  ((renderScale->type != NX_JSON_NULL) && (NX_JSON_NULL == renderSize->type))
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
        SCREEN_RenderSize rs = { SCREEN_RenderSizeMode_Scale, .scale = scale };
        SCREEN_setRenderSize(&rs);
    }
    else if ((renderSize->type != NX_JSON_NULL) && (NX_JSON_NULL == renderScale->type))
    {
        if (renderSize->type != NX_JSON_INTEGER)
        {
            // todo report error
            goto error;
        }
        u32 size = (u32)renderSize->int_value;
        SCREEN_RenderSize rs = { SCREEN_RenderSizeMode_Fixed, .size = size };
        SCREEN_setRenderSize(&rs);
    }
    else
    {
        // todo report error
        goto error;
    }

    nx_json_free(root);
    return SCREEN_LoadFileError_NONE;
error:
    nx_json_free(root);
    return SCREEN_LoadFileError_FileInvalid;
}




SCREEN_LoadFileError SCREEN_loadConfigFile(const char* filename)
{
    if (FILEU_fileExist(filename))
    {
        if (0 == strcicmp(FILEU_filenameExt(filename), "json"))
        {
            u32 size = FILEU_readFile(filename, NULL, 0);
            if ((-1 == size) || !size)
            {
                // todo report error
                return SCREEN_LoadFileError_FileInvalid;
            }
            char* buf = malloc(size + 1);
            size = FILEU_readFile(filename, buf, size);
            buf[size] = 0;

            SCREEN_LoadFileError r = SCREEN_loadConfigFromJson(buf);
            free(buf);
            return r;
        }
        else
        {
            // todo report error
            return SCREEN_LoadFileError_FileUnkExt;
        }
    }
    else
    {
        // todo report error
        return SCREEN_LoadFileError_NoFile;
    }
}






























































































